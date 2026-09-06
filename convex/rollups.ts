import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { dayOf } from "./lib/finance";
import type { Doc } from "./_generated/dataModel";

/**
 * Rollup engine (spec §20 + §25 + §27):
 *   hourly — raw healthSamples/accessPointSamples -> telemetryHourly
 *   nightly — telemetryHourly -> telemetryDaily, then business snapshots
 *   (dailySnapshots, subscriberSnapshots, marketFinancials) plus housekeeping.
 *
 * Runs from crons (hourly / nightly). Idempotent by design.
 */

const HOUR_MS = 60 * 60 * 1000;

function hourBucket(timestamp: number): number {
  return Math.floor(timestamp / HOUR_MS) * HOUR_MS;
}

const mean = (values: number[]) =>
  values.length > 0 ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const maxOf = (values: number[]) => (values.length > 0 ? Math.max(...values) : 0);

function toMbps(bytesPerSec: number): number {
  return (bytesPerSec * 8) / 1_000_000;
}

export const upsertTelemetryHourly = internalMutation({
  args: {
    marketId: v.id("markets"),
    deviceKind: v.union(v.literal("router"), v.literal("access_point")),
    routerId: v.optional(v.id("routers")),
    accessPointId: v.optional(v.id("accessPoints")),
    deviceId: v.optional(v.id("devices")),
    hourStart: v.number(),
    sampleCount: v.number(),
    avgCpuPercent: v.optional(v.number()),
    avgMemoryPercent: v.optional(v.number()),
    avgTxRateMbps: v.number(),
    avgRxRateMbps: v.number(),
    maxTxRateMbps: v.number(),
    maxRxRateMbps: v.number(),
    maxConnectedClients: v.number(),
    avgCcq: v.optional(v.number()),
    avgSignalStrengthDbm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = args.deviceId
      ? await ctx.db
          .query("telemetryHourly")
          .withIndex("by_device_hour", (q) => q.eq("deviceId", args.deviceId!))
          .filter((q) => q.eq(q.field("hourStart"), args.hourStart))
          .first()
      : args.routerId
        ? await ctx.db
            .query("telemetryHourly")
            .withIndex("by_router_hour", (q) => q.eq("routerId", args.routerId!))
            .filter((q) => q.eq(q.field("hourStart"), args.hourStart))
            .first()
        : args.accessPointId
          ? await ctx.db
              .query("telemetryHourly")
              .withIndex("by_access_point_hour", (q) => q.eq("accessPointId", args.accessPointId!))
              .filter((q) => q.eq(q.field("hourStart"), args.hourStart))
              .first()
          : null;
    const row = {
      marketId: args.marketId,
      deviceKind: args.deviceKind,
      routerId: args.routerId,
      accessPointId: args.accessPointId,
      deviceId: args.deviceId,
      hourStart: args.hourStart,
      sampleCount: args.sampleCount,
      avgCpuPercent: args.avgCpuPercent,
      avgMemoryPercent: args.avgMemoryPercent,
      avgTxRateMbps: args.avgTxRateMbps,
      avgRxRateMbps: args.avgRxRateMbps,
      maxTxRateMbps: args.maxTxRateMbps,
      maxRxRateMbps: args.maxRxRateMbps,
      maxConnectedClients: args.maxConnectedClients,
      avgCcq: args.avgCcq,
      avgSignalStrengthDbm: args.avgSignalStrengthDbm,
    };
    if (existing) {
      await ctx.db.replace(existing._id, row);
    } else {
      await ctx.db.insert("telemetryHourly", row);
    }
  },
});

/** Fold the raw samples of one hour bucket into telemetryHourly. */
export const rollupHourBucket = internalMutation({
  args: { hourStart: v.number() },
  handler: async (ctx, args): Promise<{ folded: number }> => {
    const bucketStart = args.hourStart;
    const bucketEnd = bucketStart + HOUR_MS;
    let folded = 0;

    // Routers.
    const routers = await ctx.db.query("routers").collect();
    for (const router of routers.filter((r) => r.archivedAt === undefined && r.marketId !== undefined)) {
      const samples = await ctx.db
        .query("healthSamples")
        .withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id).gte("timestamp", bucketStart).lt("timestamp", bucketEnd))
        .collect();
      if (samples.length === 0) continue;
      await ctx.runMutation(internal.rollups.upsertTelemetryHourly, {
        marketId: router.marketId!,
        deviceKind: "router",
        routerId: router._id,
        hourStart: bucketStart,
        sampleCount: samples.length,
        avgCpuPercent: mean(samples.map((s) => s.cpuPercent)),
        avgMemoryPercent: mean(samples.map((s) => s.memoryPercent)),
        avgTxRateMbps: mean(samples.map((s) => toMbps(s.txBytesPerSec))),
        avgRxRateMbps: mean(samples.map((s) => toMbps(s.rxBytesPerSec))),
        maxTxRateMbps: maxOf(samples.map((s) => toMbps(s.txBytesPerSec))),
        maxRxRateMbps: maxOf(samples.map((s) => toMbps(s.rxBytesPerSec))),
        maxConnectedClients: maxOf(samples.map((s) => s.connectedUserCount ?? 0)),
      });
      folded += 1;
    }

    // Access points.
    const accessPoints = await ctx.db.query("accessPoints").collect();
    for (const ap of accessPoints.filter((a) => a.archivedAt === undefined)) {
      const router = await ctx.db.get(ap.routerId);
      if (!router?.marketId) continue;
      const samples = await ctx.db
        .query("accessPointSamples")
        .withIndex("by_access_point_timestamp", (q) => q.eq("accessPointId", ap._id).gte("timestamp", bucketStart).lt("timestamp", bucketEnd))
        .collect();
      if (samples.length === 0) continue;
      await ctx.runMutation(internal.rollups.upsertTelemetryHourly, {
        marketId: router.marketId,
        deviceKind: "access_point",
        accessPointId: ap._id,
        hourStart: bucketStart,
        sampleCount: samples.length,
        avgTxRateMbps: mean(samples.map((s) => toMbps(s.txBytesPerSec))),
        avgRxRateMbps: mean(samples.map((s) => toMbps(s.rxBytesPerSec))),
        maxTxRateMbps: maxOf(samples.map((s) => toMbps(s.txBytesPerSec))),
        maxRxRateMbps: maxOf(samples.map((s) => toMbps(s.rxBytesPerSec))),
        maxConnectedClients: maxOf(samples.map((s) => s.connectedUserCount ?? 0)),
        avgCcq: samples.some((s) => s.ccq !== undefined) ? mean(samples.map((s) => s.ccq ?? 0)) : undefined,
        avgSignalStrengthDbm: samples.some((s) => s.signalStrengthDbm !== undefined) ? mean(samples.map((s) => s.signalStrengthDbm ?? 0)) : undefined,
      });
      folded += 1;
    }

    return { folded };
  },
});

/** Hourly cron entrypoint: fold the previous complete hour. */
export const runHourlyRollup = internalAction({
  args: {},
  handler: async (ctx): Promise<{ folded: number }> => {
    const bucketStart = hourBucket(Date.now() - HOUR_MS);
    return await ctx.runMutation(internal.rollups.rollupHourBucket, { hourStart: bucketStart });
  },
});

export const getHourlyWindow = internalQuery({
  args: { from: v.number(), to: v.number() },
  handler: async (ctx, args): Promise<Doc<"telemetryHourly">[]> => {
    return await ctx.db
      .query("telemetryHourly")
      .filter((q) =>
        q.and(
          q.gte(q.field("hourStart"), args.from),
          q.lt(q.field("hourStart"), args.to)
        )
      )
      .collect();
  },
});

export const upsertTelemetryDaily = internalMutation({
  args: {
    marketId: v.id("markets"),
    deviceKind: v.union(v.literal("router"), v.literal("access_point")),
    routerId: v.optional(v.id("routers")),
    accessPointId: v.optional(v.id("accessPoints")),
    deviceId: v.optional(v.id("devices")),
    date: v.string(),
    sampleCount: v.number(),
    avgCpuPercent: v.optional(v.number()),
    avgMemoryPercent: v.optional(v.number()),
    avgTxRateMbps: v.number(),
    avgRxRateMbps: v.number(),
    maxTxRateMbps: v.number(),
    maxRxRateMbps: v.number(),
    maxConnectedClients: v.number(),
    avgCcq: v.optional(v.number()),
    avgSignalStrengthDbm: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = args.deviceId
      ? await ctx.db
          .query("telemetryDaily")
          .withIndex("by_device_date", (q) => q.eq("deviceId", args.deviceId!))
          .filter((q) => q.eq(q.field("date"), args.date))
          .first()
      : args.routerId
        ? await ctx.db
            .query("telemetryDaily")
            .withIndex("by_router_date", (q) => q.eq("routerId", args.routerId!))
            .filter((q) => q.eq(q.field("date"), args.date))
            .first()
        : args.accessPointId
          ? await ctx.db
              .query("telemetryDaily")
              .withIndex("by_access_point_date", (q) => q.eq("accessPointId", args.accessPointId!))
              .filter((q) => q.eq(q.field("date"), args.date))
              .first()
          : null;
    const row = {
      marketId: args.marketId,
      deviceKind: args.deviceKind,
      routerId: args.routerId,
      accessPointId: args.accessPointId,
      deviceId: args.deviceId,
      date: args.date,
      sampleCount: args.sampleCount,
      avgCpuPercent: args.avgCpuPercent,
      avgMemoryPercent: args.avgMemoryPercent,
      avgTxRateMbps: args.avgTxRateMbps,
      avgRxRateMbps: args.avgRxRateMbps,
      maxTxRateMbps: args.maxTxRateMbps,
      maxRxRateMbps: args.maxRxRateMbps,
      maxConnectedClients: args.maxConnectedClients,
      avgCcq: args.avgCcq,
      avgSignalStrengthDbm: args.avgSignalStrengthDbm,
    };
    if (existing) {
      await ctx.db.replace(existing._id, row);
    } else {
      await ctx.db.insert("telemetryDaily", row);
    }
  },
});

/** Nightly: hourly -> daily for the previous local day. */
export const buildTelemetryDaily = internalAction({
  args: {},
  handler: async (ctx): Promise<{ stored: number; date: string }> => {
    const yesterday = Date.now() - 24 * HOUR_MS;
    const from = hourBucket(yesterday);
    const to = from + 24 * HOUR_MS;
    const date = dayOf(yesterday);

    const hours = await ctx.runQuery(internal.rollups.getHourlyWindow, { from, to });
    const groups = new Map<
      string,
      {
        marketId: string;
        deviceKind: "router" | "access_point";
        routerId?: string;
        accessPointId?: string;
        deviceId?: string;
        sampleCount: number;
        cpu: number[];
        mem: number[];
        tx: number[];
        rx: number[];
        maxTx: number;
        maxRx: number;
        clients: number;
        ccq: number[];
        signal: number[];
      }
    >();
    for (const hour of hours) {
      const key = `${hour.deviceKind}:${hour.deviceId ?? hour.routerId ?? hour.accessPointId}`;
      const entry = groups.get(key) ?? {
        marketId: hour.marketId,
        deviceKind: hour.deviceKind,
        routerId: hour.routerId === undefined ? undefined : hour.routerId,
        accessPointId: hour.accessPointId === undefined ? undefined : hour.accessPointId,
        deviceId: hour.deviceId === undefined ? undefined : hour.deviceId,
        sampleCount: 0,
        cpu: [],
        mem: [],
        tx: [],
        rx: [],
        maxTx: 0,
        maxRx: 0,
        clients: 0,
        ccq: [],
        signal: [],
      };
      entry.sampleCount += hour.sampleCount;
      if (hour.avgCpuPercent !== undefined) entry.cpu.push(hour.avgCpuPercent);
      if (hour.avgMemoryPercent !== undefined) entry.mem.push(hour.avgMemoryPercent);
      entry.tx.push(hour.avgTxRateMbps);
      entry.rx.push(hour.avgRxRateMbps);
      entry.maxTx = Math.max(entry.maxTx, hour.maxTxRateMbps);
      entry.maxRx = Math.max(entry.maxRx, hour.maxRxRateMbps);
      entry.clients = Math.max(entry.clients, hour.maxConnectedClients);
      if (hour.avgCcq !== undefined) entry.ccq.push(hour.avgCcq);
      if (hour.avgSignalStrengthDbm !== undefined) entry.signal.push(hour.avgSignalStrengthDbm);
      groups.set(key, entry);
    }

    let stored = 0;
    for (const entry of groups.values()) {
      await ctx.runMutation(internal.rollups.upsertTelemetryDaily, {
        marketId: entry.marketId as never,
        deviceKind: entry.deviceKind,
        routerId: entry.routerId as never,
        accessPointId: entry.accessPointId as never,
        deviceId: entry.deviceId as never,
        date,
        sampleCount: entry.sampleCount,
        avgCpuPercent: entry.cpu.length ? mean(entry.cpu) : undefined,
        avgMemoryPercent: entry.mem.length ? mean(entry.mem) : undefined,
        avgTxRateMbps: mean(entry.tx),
        avgRxRateMbps: mean(entry.rx),
        maxTxRateMbps: entry.maxTx,
        maxRxRateMbps: entry.maxRx,
        maxConnectedClients: entry.clients,
        avgCcq: entry.ccq.length ? mean(entry.ccq) : undefined,
        avgSignalStrengthDbm: entry.signal.length ? mean(entry.signal) : undefined,
      });
      stored += 1;
    }
    return { stored, date };
  },
});

export const listMarketIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const markets = await ctx.db.query("markets").filter((q) => q.eq(q.field("lifecycleStatus"), "active")).collect();
    return markets.map((m) => m._id);
  },
});

export const listActiveInvestorIds = internalQuery({
  args: {},
  handler: async (ctx) => {
    const investors = await ctx.db.query("investors").withIndex("by_status", (q) => q.eq("status", "active")).collect();
    return investors.map((i) => i._id);
  },
});

export const listActiveTeams = internalQuery({
  args: {},
  handler: async (ctx) => {
    return (await ctx.db.query("teams").withIndex("by_status", (q) => q.eq("status", "active")).collect()).map((t) => t._id);
  },
});

/** Nightly business rollups: daily snapshots + subscriber + financials + housekeeping. */
export const runNightlyBusinessRollup = internalAction({
  args: {},
  handler: async (ctx): Promise<{ built: number; date: string; month: string; investors: number }> => {
    const marketIds = await ctx.runQuery(internal.rollups.listMarketIds, {});
    const date = dayOf(Date.now() - 24 * HOUR_MS);
    const month = date.slice(0, 7);

    let built = 0;
    for (const marketId of marketIds) {
      await ctx.runMutation(internal.dailySnapshots.buildDailySnapshot, { marketId, date });
      await ctx.runMutation(internal.subscriberSnapshots.computeSubscriberSnapshot, { marketId, date });
      await ctx.runMutation(internal.expenses.computeMarketFinancials, { marketId, month });
      built += 1;
    }

    const investorIds = await ctx.runQuery(internal.rollups.listActiveInvestorIds, {});
    for (const investorId of investorIds) {
      try {
        await ctx.runMutation(internal.investors.generateInvestorReport, { investorId, period: month });
      } catch {
        // one investor failing must not block the rest of the sweep
      }
    }

    await ctx.runMutation(internal.maintenance.advanceMaintenanceWindows, {});
    await ctx.runMutation(internal.payouts.autoAdvancePayouts, {});
    await ctx.runMutation(internal.osMigrations.runStartupMigrations, {});

    return { built, date, month, investors: investorIds.length };
  },
});