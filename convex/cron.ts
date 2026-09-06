import { ConvexError, v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";

function numberValue(record: Record<string, unknown>, property: string): number {
  const value = record[property];
  const numeric = typeof value === "number" ? value : Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function percentage(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0;
  return Math.min(100, Math.max(0, (numerator / denominator) * 100));
}

type InterfaceTotals = {
  txBytes: number;
  rxBytes: number;
  errorCount: number;
  queueDrops: number;
};

export const listRouterIds = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("routers").collect()).filter((router) => router.archivedAt === undefined).map((router) => router._id),
});

export const recordRouterHealth = internalMutation({
  args: {
    routerId: v.id("routers"),
    cpuPercent: v.number(),
    memoryPercent: v.number(),
    connectedUserCount: v.number(),
    txBytes: v.number(),
    rxBytes: v.number(),
    errorCount: v.number(),
    queueDrops: v.number(),
  },
  handler: async (ctx, args) => {
    const router = await ctx.db.get(args.routerId);
    if (!router) throw new ConvexError("Router not found.");

    const now = Date.now();
    const samples = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .take(1);
    const previous = samples[0];
    const elapsedSeconds = previous ? Math.max(1, (now - previous.timestamp) / 1000) : 1;
    const txBytesPerSec = previous?.txBytes === undefined
      ? 0
      : Math.max(0, (args.txBytes - previous.txBytes) / elapsedSeconds);
    const rxBytesPerSec = previous?.rxBytes === undefined
      ? 0
      : Math.max(0, (args.rxBytes - previous.rxBytes) / elapsedSeconds);

    await ctx.db.insert("healthSamples", {
      routerId: args.routerId,
      timestamp: now,
      cpuPercent: args.cpuPercent,
      memoryPercent: args.memoryPercent,
      linkState: true,
      txBytesPerSec,
      rxBytesPerSec,
      txBytes: args.txBytes,
      rxBytes: args.rxBytes,
      connectedUserCount: args.connectedUserCount,
      errorCount: args.errorCount,
      queueDrops: args.queueDrops,
    });

    const severity = args.cpuPercent >= (router.cpuCriticalThreshold ?? 90)
      ? "critical"
      : args.cpuPercent >= (router.cpuWarningThreshold ?? 75)
        ? "warning"
        : null;
    const incidents = await ctx.db
      .query("incidents")
      .withIndex("by_router_open", (q) => q.eq("routerId", args.routerId))
      .collect();
    const openCpuIncidents = incidents.filter(
      (incident) =>
        incident.resolvedAt === undefined && incident.note.startsWith("Router CPU "),
    );

    if (severity) {
      const matchingIncident = openCpuIncidents.find(
        (incident) => incident.severity === severity,
      );
      if (!matchingIncident) {
        await ctx.db.insert("incidents", {
          routerId: args.routerId,
          openedAt: now,
          note: `Router CPU is ${args.cpuPercent.toFixed(1)}%.`,
          severity,
        });
      }
    } else {
      await Promise.all(
        openCpuIncidents.map((incident) => ctx.db.patch(incident._id, { resolvedAt: now })),
      );
    }
  },
});

export const recordCollectionFailure = internalMutation({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("incidents")
      .withIndex("by_router_open", (q) => q.eq("routerId", args.routerId))
      .collect();
    const alreadyOpen = existing.some(
      (incident) =>
        incident.resolvedAt === undefined && incident.note === "Router monitoring read failed.",
    );

    if (!alreadyOpen) {
      await ctx.db.insert("incidents", {
        routerId: args.routerId,
        openedAt: now,
        note: "Router monitoring read failed.",
        severity: "warning",
      });
    }
  },
});

export const pruneUsageSamples = internalMutation({
  args: {},
  handler: async (ctx) => {
    const retentionCutoff = Date.now() - 180 * 24 * 60 * 60 * 1000;
    const expiredSamples = await ctx.db
      .query("usageSamples")
      .withIndex("by_timestamp", (query) => query.lte("timestamp", retentionCutoff))
      .take(500);
    await Promise.all(expiredSamples.map((sample) => ctx.db.delete(sample._id)));
    return expiredSamples.length;
  },
});

export const collectAllRouterHealth = internalAction({
  args: {},
  handler: async (ctx) => {
    const routerIds = await ctx.runQuery(internal.cron.listRouterIds);

    for (const routerId of routerIds) {
      try {
        const snapshot = await ctx.runAction(
          internal.routeros.readMonitoringSnapshot,
          { routerId },
        );
        if (!snapshot.resource) throw new ConvexError("Router resource data is unavailable.");

        const totalMemory = numberValue(snapshot.resource, "total-memory");
        const freeMemory = numberValue(snapshot.resource, "free-memory");
        const counters = snapshot.interfaces.reduce<InterfaceTotals>(
          (totals, current) => ({
            txBytes: totals.txBytes + numberValue(current, "tx-byte"),
            rxBytes: totals.rxBytes + numberValue(current, "rx-byte"),
            errorCount: totals.errorCount + numberValue(current, "tx-error"),
            queueDrops:
              totals.queueDrops +
              numberValue(current, "tx-drop") +
              numberValue(current, "rx-drop"),
          }),
          { txBytes: 0, rxBytes: 0, errorCount: 0, queueDrops: 0 },
        );

        await ctx.runMutation(internal.cron.recordRouterHealth, {
          routerId,
          cpuPercent: numberValue(snapshot.resource, "cpu-load"),
          memoryPercent: percentage(totalMemory - freeMemory, totalMemory),
          connectedUserCount: snapshot.connectedUserCount,
          ...counters,
        });
      } catch {
        await ctx.runMutation(internal.cron.recordCollectionFailure, { routerId });
      }

      // Check switch health for all switches on this router
      const switches = await ctx.runQuery(
        internal.networkSwitches.listSwitchesInternal,
        { routerId }
      );
      for (const switchData of switches) {
        await ctx.runMutation(internal.incidents.checkSwitchHealth, {
          routerId,
          switchId: switchData._id,
        });
      }
    }
  },
});
