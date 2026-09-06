import { v } from "convex/values";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requireAuthenticatedUser } from "./lib/auth";

/** Recent collector run history for a router (desc by observed time). */
export const getCollectorRunHistory = query({
  args: { routerId: v.id("routers"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const router = await ctx.db.get(args.routerId);
    if (!router) return [];
    return ctx.db
      .query("collectorRuns")
      .withIndex("by_router_observedAt", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .take(args.limit ?? 40);
  },
});

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
  macAddress: v.optional(v.string()),
});

const bridgeHostValidator = v.object({
  macAddress: v.string(),
  interfaceName: v.string(),
});

const dhcpLeaseValidator = v.object({
  ipAddress: v.string(),
  macAddress: v.string(),
  hostname: v.optional(v.string()),
  status: v.optional(v.string()),
  expiresAt: v.optional(v.number()),
});

const simpleQueueValidator = v.object({
  name: v.string(),
  target: v.optional(v.string()),
  rateBps: v.optional(v.number()),
  maxLimitBps: v.optional(v.number()),
  disabled: v.optional(v.boolean()),
});

const ethernetPortValidator = v.object({
  name: v.string(),
  running: v.optional(v.boolean()),
  linkSpeedMbps: v.optional(v.number()),
  duplex: v.optional(v.string()),
  disabled: v.optional(v.boolean()),
});

const wifiRadioValidator = v.object({
  interfaceName: v.string(),
  state: v.optional(v.string()),
  frequency: v.optional(v.number()),
  channel: v.optional(v.string()),
  signalStrength: v.optional(v.number()),
  clientCount: v.optional(v.number()),
});

const systemHealthValidator = v.union(
  v.null(),
  v.object({
    temperature: v.optional(v.number()),
    temperatureUnit: v.optional(v.string()),
    voltage: v.optional(v.number()),
  }),
);

const collectorStatusValidator = v.union(v.literal("connected"), v.literal("failed"));

async function logSystemEvent(
  ctx: { db: MutationCtx["db"] },
  event: {
    routerId?: Id<"routers">;
    type: "ingest_latency" | "rate_limited" | "dropped" | "collector_backoff" | "partial_telemetry";
    severity: "info" | "warning" | "critical";
    title: string;
    details?: string;
  },
): Promise<void> {
  await ctx.db.insert("systemEvents", {
    routerId: event.routerId,
    type: event.type,
    severity: event.severity,
    title: event.title,
    details: event.details,
    occurredAt: Date.now(),
  });
}

/** Records the collector's last outcome without persisting credentials or raw responses. */
export const recordCollectorRun = internalMutation({
  args: {
    routerId: v.id("routers"),
    observedAt: v.number(),
    status: collectorStatusValidator,
    message: v.optional(v.string()),
    latencyMs: v.optional(v.number()),
    consecutiveFailures: v.optional(v.number()),
    processUptimeMs: v.optional(v.number()),
    partialTelemetry: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found.");
    const previous = await ctx.db
      .query("collectorRuns")
      .withIndex("by_router_observedAt", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .first();
    if (previous && args.observedAt - previous.observedAt < 5_000) {
      await ctx.db.patch(previous._id, {
        observedAt: args.observedAt,
        status: args.status,
        message: args.message,
        latencyMs: args.latencyMs,
        consecutiveFailures: args.consecutiveFailures,
        processUptimeMs: args.processUptimeMs,
      });
      const runId = previous._id;
      await recordRunEvents(ctx, previous._id, args);
      return runId;
    }
    const runId = await ctx.db.insert("collectorRuns", {
      routerId: args.routerId,
      observedAt: args.observedAt,
      status: args.status,
      message: args.message,
      latencyMs: args.latencyMs,
      consecutiveFailures: args.consecutiveFailures,
      processUptimeMs: args.processUptimeMs,
    });
    await recordRunEvents(ctx, runId, args);
    return runId;
  },
});

async function recordRunEvents(
  ctx: { db: MutationCtx["db"] },
  runId: Id<"collectorRuns">,
  args: {
    routerId: Id<"routers">;
    status: "connected" | "failed";
    message?: string;
    latencyMs?: number;
    consecutiveFailures?: number;
    partialTelemetry?: string[];
  },
): Promise<void> {
  const now = new Date().toISOString();
  if (args.status === "failed" && (args.consecutiveFailures ?? 0) >= 2) {
    await logSystemEvent(ctx, {
      routerId: args.routerId,
      type: "collector_backoff",
      severity: "warning",
      title: "Collector is backing off after repeated failures.",
      details: `Consecutive failures: ${args.consecutiveFailures ?? 0}. ${args.message ?? ""}`.trim(),
    });
  }
  if (args.partialTelemetry && args.partialTelemetry.length > 0) {
    await logSystemEvent(ctx, {
      routerId: args.routerId,
      type: "partial_telemetry",
      severity: "info",
      title: "Partial extended telemetry collected.",
      details: `Skipped: ${args.partialTelemetry.slice(0, 20).join(", ")}.`,
    });
  }
  if (runId && typeof args.latencyMs === "number" && args.latencyMs > 5_000) {
    await logSystemEvent(ctx, {
      routerId: args.routerId,
      type: "ingest_latency",
      severity: "warning",
      title: "Collector round-trip is slow.",
      details: `Round-trip took ${Math.round(args.latencyMs)} ms at ${now}.`,
    });
  }
}

function rate(current: number, previous: number | undefined, elapsedSeconds: number): number {
  if (previous === undefined) return 0;
  return Math.max(0, (current - previous) / elapsedSeconds);
}

function percentUsed(total: number, free: number): number {
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, ((total - free) / total) * 100));
}

/** Computes the number of addresses a RouterOS pool range such as "10.0.0.2-10.0.0.10" can offer. */
function poolCapacity(ranges: string): number {
  if (!ranges) return 0;
  let total = 0;
  for (const range of ranges.split(",")) {
    const [start, end] = range.split("-").map((part) => part.trim());
    if (!start || !end) continue;
    const startParts = start.split(".").map(Number);
    const endParts = end.split(".").map(Number);
    if (startParts.length !== 4 || endParts.length !== 4) continue;
    if (startParts.some(Number.isNaN) || endParts.some(Number.isNaN)) continue;
    const startInt = ((startParts[0] << 24) | (startParts[1] << 16) | (startParts[2] << 8) | startParts[3]) >>> 0;
    const endInt = ((endParts[0] << 24) | (endParts[1] << 16) | (endParts[2] << 8) | endParts[3]) >>> 0;
    if (endInt < startInt) continue;
    total += endInt - startInt + 1;
  }
  return total;
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
    bridgeHosts: v.optional(v.array(bridgeHostValidator)),
    dhcpLeases: v.optional(v.array(dhcpLeaseValidator)),
    simpleQueues: v.optional(v.array(simpleQueueValidator)),
    ethernetPorts: v.optional(v.array(ethernetPortValidator)),
    wifiRadios: v.optional(v.array(wifiRadioValidator)),
    systemHealth: v.optional(systemHealthValidator),
    identity: v.optional(v.union(v.string(), v.null())),
    configurationSnapshotJson: v.string(),
    latencyMs: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found.");
    const now = args.observedAt;

    if (typeof args.latencyMs === "number" && args.latencyMs > 5_000) {
      await logSystemEvent(ctx, {
        routerId: args.routerId,
        type: "ingest_latency",
        severity: "warning",
        title: "Collector round-trip is slow.",
        details: `Round-trip took ${Math.round(args.latencyMs)} ms.`,
      });
    }

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
    const accessPointByPort = new Map(accessPoints.filter((accessPoint) => accessPoint.archivedAt === undefined).map((accessPoint) => [accessPoint.port, accessPoint]));
    const portByMac = new Map(
      (args.bridgeHosts ?? [])
        .filter((host) => host.macAddress && host.interfaceName)
        .map((host) => [host.macAddress.toUpperCase(), host.interfaceName]),
    );
    const resolveAccessPointForSession = (session: { interfaceName: string; macAddress?: string }) => {
      const byInterface = accessPointByPort.get(session.interfaceName);
      if (byInterface) return byInterface;
      if (session.macAddress) {
        const port = portByMac.get(session.macAddress.toUpperCase());
        if (port) return accessPointByPort.get(port);
      }
      return undefined;
    };
    const sessionAccessPointIds = args.hotspotSessions.map((session) => resolveAccessPointForSession(session)?._id);
    const openIncidents = await ctx.db
      .query("incidents")
      .withIndex("by_router_open", (query) => query.eq("routerId", args.routerId))
      .collect();

    const memoryPercent = percentUsed(args.totalMemoryBytes, args.freeMemoryBytes);
    const memoryWarningThreshold = router.memoryWarningThreshold ?? 80;
    const memoryCriticalThreshold = router.memoryCriticalThreshold ?? 90;
    const memorySeverity = memoryPercent >= memoryCriticalThreshold
      ? "critical"
      : memoryPercent >= memoryWarningThreshold
        ? "warning"
        : null;
    const openMemoryIncidents = openIncidents.filter(
      (incident) => incident.resolvedAt === undefined && incident.note.startsWith("Router memory "),
    );
    if (memorySeverity) {
      const matchingIncident = openMemoryIncidents.find(
        (incident) => incident.severity === memorySeverity,
      );
      if (!matchingIncident) {
        await ctx.db.insert("incidents", {
          routerId: args.routerId,
          openedAt: now,
          note: `Router memory is ${memoryPercent.toFixed(1)}%.`,
          severity: memorySeverity,
        });
      }
    } else {
      await Promise.all(
        openMemoryIncidents.map((incident) => ctx.db.patch(incident._id, { resolvedAt: now })),
      );
    }

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
      const connectedUserCount = sessionAccessPointIds.filter((id) => id === accessPoint._id).length;
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

    // Dharma lease sync — upsert by router+ip, drop leases that disappeared.
    const leasedByIp = new Map((args.dhcpLeases ?? []).map((lease) => [`${args.routerId}:${lease.ipAddress}`, lease]));
    const existingLeases = await ctx.db
      .query("dhcpLeases")
      .withIndex("by_router", (query) => query.eq("routerId", args.routerId))
      .collect();
    const existingByKey = new Map(existingLeases.map((lease) => [`${lease.routerId}:${lease.ipAddress}`, lease]));
    for (const [key, lease] of leasedByIp) {
      const existing = existingByKey.get(key);
      const patch = {
        macAddress: lease.macAddress,
        hostname: lease.hostname,
        status: lease.status,
        expiresAt: lease.expiresAt,
        observedAt: args.observedAt,
      };
      if (existing) {
        if (existing.observedAt !== args.observedAt) {
          await ctx.db.patch(existing._id, patch);
        }
      } else {
        await ctx.db.insert("dhcpLeases", {
          routerId: args.routerId,
          ...lease,
          observedAt: args.observedAt,
        });
      }
    }
    for (const [key, lease] of existingByKey) {
      if (!leasedByIp.has(key)) {
        await ctx.db.delete(lease._id);
      }
    }

    // Simple queue sync — same upsert-by-name, delete-missing pattern.
    const queuesByName = new Map((args.simpleQueues ?? []).map((queue) => [`${args.routerId}:${queue.name}`, queue]));
    const existingQueues = await ctx.db
      .query("simpleQueues")
      .withIndex("by_router", (query) => query.eq("routerId", args.routerId))
      .collect();
    const existingQueueByKey = new Map(existingQueues.map((queue) => [`${queue.routerId}:${queue.name}`, queue]));
    for (const [key, queue] of queuesByName) {
      const existing = existingQueueByKey.get(key);
      const patch = {
        target: queue.target,
        rateBps: queue.rateBps,
        maxLimitBps: queue.maxLimitBps,
        disabled: queue.disabled,
        observedAt: args.observedAt,
      };
      if (existing) {
        if (existing.observedAt !== args.observedAt) {
          await ctx.db.patch(existing._id, patch);
        }
      } else {
        await ctx.db.insert("simpleQueues", {
          routerId: args.routerId,
          ...queue,
          observedAt: args.observedAt,
        });
      }
    }
    for (const [key, queue] of existingQueueByKey) {
      if (!queuesByName.has(key)) {
        await ctx.db.delete(queue._id);
      }
    }

    // Latest per-router telemetry document.
    if (args.identity !== undefined || args.systemHealth !== undefined || args.ethernetPorts || args.wifiRadios) {
      const latestTelemetry = await ctx.db
        .query("routerTelemetry")
        .withIndex("by_router", (query) => query.eq("routerId", args.routerId))
        .first();
      const telemetryPatch = {
        observedAt: args.observedAt,
        identity: args.identity ?? undefined,
        systemHealth: args.systemHealth ?? undefined,
        ethernetPorts: args.ethernetPorts,
        wifiRadios: args.wifiRadios,
      };
      if (latestTelemetry) {
        await ctx.db.patch(latestTelemetry._id, telemetryPatch);
      } else {
        await ctx.db.insert("routerTelemetry", {
          routerId: args.routerId,
          ...telemetryPatch,
        });
      }
    }

    // DHCP pool exhaustion detection — derived from pool ranges in the config snapshot.
    if (args.dhcpLeases && args.dhcpLeases.length > 0) {
      let poolCapacitySum = 0;
      try {
        const config: { pools?: Array<{ ranges?: string }> } = JSON.parse(args.configurationSnapshotJson);
        poolCapacitySum = (config.pools ?? []).reduce(
          (sum, pool) => sum + poolCapacity(pool.ranges ?? ""),
          0,
        );
      } catch {
        poolCapacitySum = 0;
      }
      const leaseCount = args.dhcpLeases.filter((lease) => lease.status === "bound" || lease.status === undefined).length;
      const openPoolIncident = openIncidents.find(
        (incident) => incident.resolvedAt === undefined && incident.note.startsWith("DHCP pool "),
      );
      if (poolCapacitySum > 0 && leaseCount >= poolCapacitySum) {
        if (!openPoolIncident) {
          await ctx.db.insert("incidents", {
            routerId: args.routerId,
            openedAt: now,
            note: "DHCP pool is exhausted.",
            severity: "critical",
          });
        }
      } else if (poolCapacitySum > 0 && leaseCount >= poolCapacitySum * 0.95) {
        if (!openPoolIncident) {
          await ctx.db.insert("incidents", {
            routerId: args.routerId,
            openedAt: now,
            note: "DHCP pool is nearing exhaustion.",
            severity: "warning",
          });
        }
      } else if (openPoolIncident) {
        await ctx.db.patch(openPoolIncident._id, { resolvedAt: now });
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
      const accessPoint = resolveAccessPointForSession(session);
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