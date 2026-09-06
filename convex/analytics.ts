import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { dayOf } from "./lib/finance";

/**
 * Performance analytics (spec "Performance Reporting"). Pure aggregations over
 * snapshots/ledgers/telemetry rollups — no per-row scans of raw samples.
 */
export const getRevenueTrend = query({
  args: { marketId: v.optional(v.id("markets")), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "analytics:read");
    const days = args.days ?? 30;
    const from = dayOf(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await ctx.db.query("dailySnapshots").withIndex("by_date", (q) => q.gte("date", from)).collect();
    const filtered = args.marketId ? rows.filter((r) => r.marketId === args.marketId) : rows;
    const byDate = new Map<string, { revenueLocal: number; revenueUSD: number; netContributionLocal: number; newSubscribers: number; salesCount: number }>();
    for (const row of filtered) {
      const entry = byDate.get(row.date) ?? { revenueLocal: 0, revenueUSD: 0, netContributionLocal: 0, newSubscribers: 0, salesCount: 0 };
      entry.revenueLocal += row.revenueLocal;
      entry.revenueUSD += row.revenueUSD;
      entry.netContributionLocal += row.netContributionLocal;
      entry.newSubscribers += row.newSubscribers;
      entry.salesCount += row.salesCount;
      byDate.set(row.date, entry);
    }
    const totalRevenueUSD = filtered.reduce((sum, r) => sum + r.revenueUSD, 0);
    const sortedDates = Array.from(byDate.keys()).sort();
    let dayOverDayPercent: number | null = null;
    if (sortedDates.length >= 2) {
      const last = sortedDates[sortedDates.length - 1];
      const previous = sortedDates[sortedDates.length - 2];
      const prevValue = byDate.get(previous)?.revenueUSD ?? 0;
      const lastValue = byDate.get(last)?.revenueUSD ?? 0;
      if (prevValue > 0) dayOverDayPercent = ((lastValue - prevValue) / prevValue) * 100;
    }
    return {
      days,
      series: Array.from(byDate.entries())
        .sort((a, b) => a[0].localeCompare(b[0]))
        .map(([date, v]) => ({ date, ...v })),
      totalRevenueUSD,
      dayOverDayPercent,
    };
  },
});

export const getSubscriberTrend = query({
  args: { marketId: v.optional(v.id("markets")), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "subscriber_snapshots:read");
    const days = args.days ?? 30;
    const from = dayOf(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = (await ctx.db.query("subscriberSnapshots").collect())
      .filter((s) => s.date >= from && (!args.marketId || s.marketId === args.marketId))
      .sort((a, b) => a.date.localeCompare(b.date));
    const byDate = new Map<string, { activeCount: number; newCount: number }>();
    for (const row of rows) {
      const entry = byDate.get(row.date) ?? { activeCount: 0, newCount: 0 };
      entry.activeCount += row.activeCount;
      entry.newCount += row.newCount;
      byDate.set(row.date, entry);
    }
    return Array.from(byDate.entries()).map(([date, v]) => ({ date, ...v }));
  },
});

export const getTopAgents = query({
  args: { days: v.optional(v.number()), marketId: v.optional(v.id("markets")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "agents:read");
    const days = args.days ?? 30;
    const from = Date.now() - days * 24 * 60 * 60 * 1000;
    const activity = await ctx.db.query("agentActivity").withIndex("by_time", (q) => q.gte("occurredAt", from)).collect();
    const filtered = args.marketId ? activity.filter((a) => a.marketId === args.marketId) : activity;
    const summary = new Map<string, { count: number; revenueLocal: number; currency: string }>();
    for (const a of filtered) {
      const entry = summary.get(a.agentId) ?? { count: 0, revenueLocal: 0, currency: a.currency };
      entry.count += 1;
      entry.revenueLocal += a.amountLocal;
      summary.set(a.agentId, entry);
    }
    const agents = new Map((await ctx.db.query("agents").collect()).map((a) => [a._id, a.name]));
    return Array.from(summary.entries())
      .map(([agentId, s]) => ({ agentId, agentName: agents.get(agentId as never) ?? agentId, ...s }))
      .sort((a, b) => b.revenueLocal - a.revenueLocal)
      .slice(0, args.limit ?? 10);
  },
});

export const getDeviceUptimeStats = query({
  args: { marketId: v.optional(v.id("markets")), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "telemetry_health:read");
    const days = args.days ?? 7;
    const from = dayOf(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = (await ctx.db.query("telemetryDaily").collect())
      .filter((t) => t.date >= from && (!args.marketId || t.marketId === args.marketId));
    const routers = rows.filter((r) => r.deviceKind === "router");
    const aps = rows.filter((r) => r.deviceKind === "access_point");
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    return {
      days,
      routerCount: new Set(routers.map((r) => r.routerId)).size,
      accessPointCount: new Set(aps.map((r) => r.accessPointId)).size,
      avgRouterCpuPercent: avg(routers.map((r) => r.avgCpuPercent).filter((c): c is number => c !== undefined)),
      avgRouterMemPercent: avg(routers.map((r) => r.avgMemoryPercent).filter((c): c is number => c !== undefined)),
      peakConnectedClients: Math.max(0, ...routers.map((r) => r.maxConnectedClients), ...aps.map((r) => r.maxConnectedClients)),
      peakTxMbps: Math.max(0, ...rows.map((r) => r.maxTxRateMbps)),
      peakRxMbps: Math.max(0, ...rows.map((r) => r.maxRxRateMbps)),
      avgCcq: avg(aps.map((r) => r.avgCcq).filter((c): c is number => c !== undefined)),
    };
  },
});

export const getSalesMix = query({
  args: { days: v.optional(v.number()), marketId: v.optional(v.id("markets")) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "business_events:read");
    const days = args.days ?? 30;
    const from = Date.now() - days * 24 * 60 * 60 * 1000;
    const activity = await ctx.db.query("agentActivity").withIndex("by_time", (q) => q.gte("occurredAt", from)).collect();
    const filtered = args.marketId ? activity.filter((a) => a.marketId === args.marketId) : activity;
    const mix = new Map<string, { count: number; revenueLocal: number; planId?: string }>();
    for (const a of filtered) {
      const key = a.planCode ?? a.action;
      const entry = mix.get(key) ?? { count: 0, revenueLocal: 0 };
      entry.count += 1;
      entry.revenueLocal += a.amountLocal;
      mix.set(key, entry);
    }
    return Array.from(mix.entries())
      .map(([plan, entry]) => ({ plan, ...entry }))
      .sort((a, b) => b.revenueLocal - a.revenueLocal);
  },
});