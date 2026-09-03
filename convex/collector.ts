import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

const interfaceValidator = v.object({
  name: v.string(),
  running: v.boolean(),
  txBytes: v.number(),
  rxBytes: v.number(),
  txErrors: v.number(),
  rxErrors: v.number(),
  txDrops: v.number(),
  rxDrops: v.number(),
});

const hotspotSessionValidator = v.object({
  identifier: v.string(),
  username: v.string(),
  bytes: v.number(),
  interfaceName: v.string(),
});

function rate(current: number, previous: number | undefined, elapsedSeconds: number): number {
  if (previous === undefined) return 0;
  return Math.max(0, (current - previous) / elapsedSeconds);
}

function percentUsed(total: number, free: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, ((total - free) / total) * 100));
}

export const ingestSnapshot = internalMutation({
  args: {
    routerId: v.id("routers"),
    observedAt: v.number(),
    cpuPercent: v.number(),
    totalMemoryBytes: v.number(),
    freeMemoryBytes: v.number(),
    interfaces: v.array(interfaceValidator),
    hotspotSessions: v.array(hotspotSessionValidator),
    configurationSnapshotJson: v.string(),
  },
  handler: async (ctx, args) => {
    const router = await ctx.db.get(args.routerId);
    if (!router) throw new Error("Router not found.");

    const previousRouterSample = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (query) => query.eq("routerId", args.routerId))
      .order("desc")
      .first();
    const elapsedSeconds = previousRouterSample
      ? Math.max(1, (args.observedAt - previousRouterSample.timestamp) / 1000)
      : 1;
    const totals = args.interfaces.reduce(
      (current, item) => ({
        txBytes: current.txBytes + item.txBytes,
        rxBytes: current.rxBytes + item.rxBytes,
        errorCount: current.errorCount + item.txErrors + item.rxErrors,
        queueDrops: current.queueDrops + item.txDrops + item.rxDrops,
      }),
      { txBytes: 0, rxBytes: 0, errorCount: 0, queueDrops: 0 },
    );

    await ctx.db.insert("healthSamples", {
      routerId: args.routerId,
      timestamp: args.observedAt,
      cpuPercent: args.cpuPercent,
      memoryPercent: percentUsed(args.totalMemoryBytes, args.freeMemoryBytes),
      linkState: true,
      txBytesPerSec: rate(totals.txBytes, previousRouterSample?.txBytes, elapsedSeconds),
      rxBytesPerSec: rate(totals.rxBytes, previousRouterSample?.rxBytes, elapsedSeconds),
      txBytes: totals.txBytes,
      rxBytes: totals.rxBytes,
      connectedUserCount: args.hotspotSessions.length,
      errorCount: totals.errorCount,
      queueDrops: totals.queueDrops,
    });

    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (query) => query.eq("routerId", args.routerId))
      .collect();
    const accessPointByPort = new Map(accessPoints.map((accessPoint) => [accessPoint.port, accessPoint]));
    const openIncidents = await ctx.db
      .query("incidents")
      .withIndex("by_router_open", (query) => query.eq("routerId", args.routerId))
      .collect();
    const now = args.observedAt;

    const cpuSeverity = args.cpuPercent >= (router.cpuCriticalThreshold ?? 90)
      ? "critical"
      : args.cpuPercent >= (router.cpuWarningThreshold ?? 75)
        ? "warning"
        : null;
    const openCpuIncidents = openIncidents.filter(
      (incident) => incident.resolvedAt === undefined && incident.note.startsWith("Router CPU "),
    );
    if (cpuSeverity) {
      const matchingIncident = openCpuIncidents.find(
        (incident) => incident.severity === cpuSeverity,
      );
      if (!matchingIncident) {
        await ctx.db.insert("incidents", {
          routerId: args.routerId,
          openedAt: now,
          note: `Router CPU is ${args.cpuPercent.toFixed(1)}%.`,
          severity: cpuSeverity,
        });
      }
    } else {
      await Promise.all(
        openCpuIncidents.map((incident) => ctx.db.patch(incident._id, { resolvedAt: now })),
      );
    }

    for (const item of args.interfaces) {
      const accessPoint = accessPointByPort.get(item.name);
      if (!accessPoint) continue;
      const previousAccessPointSample = await ctx.db
        .query("accessPointSamples")
        .withIndex("by_access_point_timestamp", (query) =>
          query.eq("accessPointId", accessPoint._id),
        )
        .order("desc")
        .first();
      const accessPointElapsedSeconds = previousAccessPointSample
        ? Math.max(1, (args.observedAt - previousAccessPointSample.timestamp) / 1000)
        : 1;
      const connectedUserCount = args.hotspotSessions.filter(
        (session) => session.interfaceName === item.name,
      ).length;
      await ctx.db.insert("accessPointSamples", {
        routerId: args.routerId,
        accessPointId: accessPoint._id,
        timestamp: args.observedAt,
        linkState: item.running,
        txBytesPerSec: rate(item.txBytes, previousAccessPointSample?.txBytes, accessPointElapsedSeconds),
        rxBytesPerSec: rate(item.rxBytes, previousAccessPointSample?.rxBytes, accessPointElapsedSeconds),
        errorCount: item.txErrors + item.rxErrors,
        queueDrops: item.txDrops + item.rxDrops,
        txBytes: item.txBytes,
        rxBytes: item.rxBytes,
        connectedUserCount,
      });
      const openLinkIncident = openIncidents.find(
        (incident) =>
          incident.resolvedAt === undefined &&
          incident.accessPointId === accessPoint._id &&
          incident.note === "Access point link is down.",
      );
      if (!item.running && !openLinkIncident) {
        await ctx.db.insert("incidents", {
          routerId: args.routerId,
          accessPointId: accessPoint._id,
          openedAt: now,
          note: "Access point link is down.",
          severity: "critical",
        });
      }
      if (item.running && openLinkIncident) {
        await ctx.db.patch(openLinkIncident._id, { resolvedAt: now });
      }
    }

    const currentSessionIdentifiers = new Set(args.hotspotSessions.map((session) => session.identifier));
    const activeSessions = await ctx.db
      .query("activeHotspotSessions")
      .withIndex("by_router", (query) => query.eq("routerId", args.routerId))
      .collect();
    for (const activeSession of activeSessions) {
      if (!currentSessionIdentifiers.has(activeSession.sessionIdentifier)) {
        await ctx.db.delete(activeSession._id);
      }
    }

    for (const session of args.hotspotSessions) {
      const previousUsageSample = await ctx.db
        .query("usageSamples")
        .withIndex("by_router_subscriber_timestamp", (query) =>
          query
            .eq("routerId", args.routerId)
            .eq("subscriberIdentifier", session.identifier),
        )
        .order("desc")
        .first();
      const accessPoint = accessPointByPort.get(session.interfaceName);
      const activeSession = activeSessions.find(
        (item) => item.sessionIdentifier === session.identifier,
      );
      const activeSessionPatch = {
        accessPointId: accessPoint?._id,
        subscriberIdentifier: session.username,
        observedBytes: session.bytes,
        observedAt: args.observedAt,
      };
      if (activeSession) {
        await ctx.db.patch(activeSession._id, activeSessionPatch);
      } else {
        await ctx.db.insert("activeHotspotSessions", {
          routerId: args.routerId,
          sessionIdentifier: session.identifier,
          ...activeSessionPatch,
        });
      }
      await ctx.db.insert("usageSamples", {
        routerId: args.routerId,
        accessPointId: accessPoint?._id,
        subscriberIdentifier: session.identifier,
        timestamp: args.observedAt,
        byteDelta: Math.max(0, session.bytes - (previousUsageSample?.observedBytes ?? session.bytes)),
        observedBytes: session.bytes,
      });
    }

    const latestConfiguration = await ctx.db
      .query("routerConfigurationSnapshots")
      .withIndex("by_router_timestamp", (query) => query.eq("routerId", args.routerId))
      .order("desc")
      .first();
    if (latestConfiguration?.snapshotJson !== args.configurationSnapshotJson) {
      await ctx.db.insert("routerConfigurationSnapshots", {
        routerId: args.routerId,
        observedAt: args.observedAt,
        snapshotJson: args.configurationSnapshotJson,
      });
    }
  },
});
