import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { dayOf } from "./lib/finance";

/**
 * Capacity planning (spec "Capacity Planning"): peak demand per market from
 * the telemetry rollups, so operators can see saturation headroom before
 * customers feel it.
 */
export const getCapacityOverview = query({
  args: { marketId: v.optional(v.id("markets")), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "capacity:read");
    const days = args.days ?? 30;
    const from = dayOf(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = (await ctx.db.query("telemetryDaily").collect()).filter(
      (t) => t.date >= from && (!args.marketId || t.marketId === args.marketId),
    );

    const byMarket = new Map<
      string,
      {
        marketId: string;
        routers: number;
        accessPoints: number;
        peakClients: number;
        avgPeakClients: number;
        peakTxMbps: number;
        peakRxMbps: number;
        avgCcq: number | undefined;
        cpuPctAboveThreshold: number;
      }
    >();
    for (const row of rows) {
      const entry = byMarket.get(row.marketId) ?? {
        marketId: row.marketId,
        routers: 0,
        accessPoints: 0,
        peakClients: 0,
        avgPeakClients: 0,
        peakTxMbps: 0,
        peakRxMbps: 0,
        avgCcq: undefined as number | undefined,
        cpuPctAboveThreshold: 0,
      };
      if (row.deviceKind === "router") entry.routers += 1;
      else entry.accessPoints += 1;
      entry.peakClients = Math.max(entry.peakClients, row.maxConnectedClients);
      entry.peakTxMbps = Math.max(entry.peakTxMbps, row.maxTxRateMbps);
      entry.peakRxMbps = Math.max(entry.peakRxMbps, row.maxRxRateMbps);
      if ((row.avgCpuPercent ?? 0) >= 80) entry.cpuPctAboveThreshold += 1;
      if (row.avgCcq !== undefined) {
        const ccq = row.avgCcq;
        entry.avgCcq = entry.avgCcq === undefined ? ccq : (entry.avgCcq * 0.8 + ccq * 0.2);
      }
      byMarket.set(row.marketId, entry);
    }

    const markets = new Map((await ctx.db.query("markets").collect()).map((m) => [m._id, m.name]));
    return Array.from(byMarket.values()).map((entry) => ({
      ...entry,
      marketName: markets.get(entry.marketId as never) ?? entry.marketId,
      avgCcq: entry.avgCcq !== undefined ? Math.round(entry.avgCcq) : undefined,
    }));
  },
});

export const getMarketCapacityDetail = query({
  args: { marketId: v.id("markets"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "capacity:read");
    const days = args.days ?? 14;
    const from = dayOf(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = (await ctx.db.query("telemetryDaily").withIndex("by_market_date", (q) => q.eq("marketId", args.marketId).gte("date", from)).collect()).sort(
      (a, b) => a.date.localeCompare(b.date),
    );
    const routers = rows.filter((r) => r.deviceKind === "router");
    const aps = rows.filter((r) => r.deviceKind === "access_point");
    return {
      days,
      peakConnectedClients: Math.max(0, ...routers.map((r) => r.maxConnectedClients)),
      peakTxMbps: Math.max(0, ...rows.map((r) => r.maxTxRateMbps)),
      peakRxMbps: Math.max(0, ...rows.map((r) => r.maxRxRateMbps)),
      avgCcq: aps.length
        ? Math.round((aps.reduce((s, r) => s + (r.avgCcq ?? 0), 0) / aps.length) * 10) / 10
        : undefined,
      dailySeries: rows.map((r) => ({
        date: r.date,
        kind: r.deviceKind,
        maxClients: r.maxConnectedClients,
        txMbps: r.maxTxRateMbps,
        rxMbps: r.maxRxRateMbps,
        cpuPercent: r.avgCpuPercent,
        ccq: r.avgCcq,
      })),
    };
  },
});