import { v } from "convex/values";
import { action, mutation } from "./_generated/server";
import { getSystemResource, getInterfaces, getHotspotActive, getBridgeHosts } from "./routeros";

// Cron job configuration - this runs every 30 seconds
export const collectHealthData = action({
  args: {},
  handler: async (ctx) => {
    const routers = await ctx.runQuery(async (innerCtx) => {
      return await innerCtx.db.query("routers").collect();
    });

    for (const router of routers) {
      try {
        // Get system resources
        const resource = await getSystemResource(ctx, { routerId: router._id });
        const cpuPercent = Number(resource["cpu-load"]) || 0;
        const totalMemory = Number(resource["total-memory"]);
        const freeMemory = Number(resource["free-memory"]);
        const memoryPercent = totalMemory > 0 ? Math.round((1 - freeMemory / totalMemory) * 100) : 0;

        // Get interfaces for access point data
        const interfaces = await getInterfaces(ctx, { routerId: router._id });
        const accessPoints = await ctx.runQuery(async (innerCtx) => {
          return await innerCtx.db
            .query("accessPoints")
            .withIndex("by_router", (q) => q.eq("routerId", router._id))
            .collect();
        });

        // Store router-wide health sample
        await ctx.runMutation(async (innerCtx) => {
          await innerCtx.db.insert("healthSamples", {
            routerId: router._id,
            accessPointId: undefined,
            timestamp: Date.now(),
            cpuPercent,
            memoryPercent,
            linkState: true, // Router is reachable
            txBytesPerSec: 0,
            rxBytesPerSec: 0,
            errorCount: 0,
            queueDrops: 0,
          });
        });

        // Store per-access-point health samples
        for (const ap of accessPoints) {
          const interfaceData = interfaces.find((iface: any) => iface.name === ap.port);
          if (interfaceData) {
            const linkState = String(interfaceData.running || "").toLowerCase() === "true";
            const errors = ["rx-drop", "tx-drop", "rx-error", "tx-error"].reduce(
              (total: number, field: string) => total + (Number(interfaceData[field]) || 0),
              0
            );
            const drops = Number(interfaceData["tx-queue-drop"]) || 0;

            await ctx.runMutation(async (innerCtx) => {
              await innerCtx.db.insert("healthSamples", {
                routerId: router._id,
                accessPointId: ap._id,
                timestamp: Date.now(),
                cpuPercent,
                memoryPercent,
                linkState,
                txBytesPerSec: Number(interfaceData["tx-byte"]) || 0,
                rxBytesPerSec: Number(interfaceData["rx-byte"]) || 0,
                errorCount: errors,
                queueDrops: drops,
              });
            });

            // Create incident if link is down
            if (!linkState) {
              await ctx.runMutation(async (innerCtx) => {
                const existingIncident = await innerCtx.db
                  .query("incidents")
                  .withIndex("by_router_open", (q) =>
                    q.eq("routerId", router._id).eq("accessPointId", ap._id)
                  )
                  .filter((q) => q.eq(q.field("resolvedAt"), undefined))
                  .first();

                if (!existingIncident) {
                  await innerCtx.db.insert("incidents", {
                    routerId: router._id,
                    accessPointId: ap._id,
                    openedAt: Date.now(),
                    resolvedAt: undefined,
                    acknowledgedBy: undefined,
                    note: `Access point ${ap.name} (${ap.port}) link is down`,
                    severity: "critical",
                  });
                }
              });
            }
          }
        }

        // Check CPU thresholds and create incidents if needed
        if (cpuPercent > 90) {
          await ctx.runMutation(async (innerCtx) => {
            const existingIncident = await innerCtx.db
              .query("incidents")
              .withIndex("by_router_open", (q) => q.eq("routerId", router._id))
              .filter((q) => q.eq(q.field("accessPointId"), undefined))
              .filter((q) => q.eq(q.field("resolvedAt"), undefined))
              .filter((q) => q.neq(q.field("note"), "Router CPU critical"))
              .first();

            if (!existingIncident) {
              await innerCtx.db.insert("incidents", {
                routerId: router._id,
                accessPointId: undefined,
                openedAt: Date.now(),
                resolvedAt: undefined,
                acknowledgedBy: undefined,
                note: "Router CPU critical",
                severity: "critical",
              });
            }
          });
        }
      } catch (error) {
        console.error(`Failed to collect health data for router ${router.name}:`, error);
        // Create incident for router unreachable
        await ctx.runMutation(async (innerCtx) => {
          const existingIncident = await innerCtx.db
            .query("incidents")
            .withIndex("by_router_open", (q) => q.eq("routerId", router._id))
            .filter((q) => q.eq(q.field("accessPointId"), undefined))
            .filter((q) => q.eq(q.field("resolvedAt"), undefined))
            .filter((q) => q.neq(q.field("note"), "Router unreachable"))
            .first();

          if (!existingIncident) {
            await innerCtx.db.insert("incidents", {
              routerId: router._id,
              accessPointId: undefined,
              openedAt: Date.now(),
              resolvedAt: undefined,
              acknowledgedBy: undefined,
              note: "Router unreachable",
              severity: "critical",
            });
          }
        });
      }
    }
  },
});

// Cron job configuration - this runs every 60 seconds
export const collectUsageData = action({
  args: {},
  handler: async (ctx) => {
    const routers = await ctx.runQuery(async (innerCtx) => {
      return await innerCtx.db.query("routers").collect();
    });

    for (const router of routers) {
      try {
        const [sessions, hosts, interfaces] = await Promise.all([
          getHotspotActive(ctx, { routerId: router._id }),
          getBridgeHosts(ctx, { routerId: router._id }),
          getInterfaces(ctx, { routerId: router._id }),
        ]);

        const timestamp = Date.now();

        // Build MAC-to-port mapping
        const monitoredPorts = new Set(["ether2", "ether3", "ether4", "wlan1"]);
        const macToPort = new Map<string, string>();
        for (const host of hosts) {
          const mac = String(host["mac-address"] || "").toLowerCase().replace(/-/g, ":");
          const port = String(host["on-interface"] || host.interface || "");
          if (mac && monitoredPorts.has(port)) {
            macToPort.set(mac, port);
          }
        }

        // Collect per-user usage
        for (const session of sessions) {
          const sessionId = String(session[".id"] || "");
          const username = String(session.user || "");
          const port = macToPort.get(String(session["mac-address"] || "").toLowerCase().replace(/-/g, ":"));
          const rxBytes = Number(session["bytes-in"]);
          const txBytes = Number(session["bytes-out"]);

          if (sessionId && username && port && Number.isFinite(rxBytes) && Number.isFinite(txBytes)) {
            await ctx.runMutation(async (innerCtx) => {
              await innerCtx.db.insert("usageSamples", {
                routerId: router._id,
                accessPointId: undefined,
                subscriberIdentifier: username,
                timestamp,
                byteDelta: rxBytes + txBytes,
              });
            });
          }
        }

        // Collect per-access-point usage
        for (const iface of interfaces) {
          const port = String(iface.name || "");
          if (!monitoredPorts.has(port)) continue;

          const rxBytes = Number(iface["rx-byte"]);
          const txBytes = Number(iface["tx-byte"]);

          if (Number.isFinite(rxBytes) && Number.isFinite(txBytes)) {
            await ctx.runMutation(async (innerCtx) => {
              const accessPoints = await innerCtx.db
                .query("accessPoints")
                .withIndex("by_router", (q) => q.eq("routerId", router._id))
                .collect();
              const accessPoint = accessPoints.find((ap) => ap.port === port);

              if (accessPoint) {
                await innerCtx.db.insert("usageSamples", {
                  routerId: router._id,
                  accessPointId: accessPoint._id,
                  subscriberIdentifier: "system",
                  timestamp,
                  byteDelta: rxBytes + txBytes,
                });
              }
            });
          }
        }
      } catch (error) {
        console.error(`Failed to collect usage data for router ${router.name}:`, error);
      }
    }

    // Prune old usage samples (older than 180 days)
    await ctx.runMutation(async (innerCtx) => {
      const cutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
      const oldSamples = await innerCtx.db
        .query("usageSamples")
        .withIndex("by_router_timestamp", (q) => q.lt("timestamp", cutoff))
        .collect();

      for (const sample of oldSamples) {
        await innerCtx.db.delete(sample._id);
      }
    });
  },
});
