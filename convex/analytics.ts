import { v } from "convex/values";
import { query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { enforceTenantOnResource, readScopedTenant, readTenantList } from "./lib/tenant";
import type { Doc } from "./_generated/dataModel";
import { dayOf } from "./lib/finance";

async function tenantActivityRows(ctx: QueryCtx, tenantId: Id<"tenants">, from: number) {
  const [tagged, markets] = await Promise.all([
    ctx.db.query("agentActivity").withIndex("by_tenant_time", (q) => q.eq("tenantId", tenantId).gte("occurredAt", from)).collect(),
    ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
  ]);
  const marketRows = await Promise.all(markets.map((market) =>
    ctx.db.query("agentActivity").withIndex("by_market_time", (q) => q.eq("marketId", market._id).gte("occurredAt", from))
      .filter((q) => q.eq(q.field("tenantId"), undefined))
      .collect()
  ));
  const rows = new Map(tagged.map((row) => [row._id, row]));
  for (const row of marketRows.flat()) {
    // Market ownership is authoritative for legacy rows that predate tenantId.
    if (row.tenantId === undefined || row.tenantId === tenantId) rows.set(row._id, row);
  }
  return [...rows.values()];
}

/**
 * Performance analytics (spec "Performance Reporting"). Pure aggregations over
 * billing snapshots and ledgers — no per-row scans of raw data.
 */
export const getRevenueTrend = query({
  args: { marketId: v.optional(v.id("markets")), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "analytics:read");
    if (args.marketId && !(await enforceTenantOnResource(ctx, await ctx.db.get(args.marketId), "market"))) throw new Error("Market not found");
    const days = args.days ?? 30;
    const from = dayOf(Date.now() - days * 24 * 60 * 60 * 1000);
    const rows = await readTenantList<Doc<"dailySnapshots">>(ctx, {
      all: () => ctx.db.query("dailySnapshots").withIndex("by_date", (q) => q.gte("date", from)).collect(),
      tenant: (tenantId) => ctx.db.query("dailySnapshots").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect().then((items) => items.filter((row) => row.date >= from)),
      legacy: () => ctx.db.query("dailySnapshots").withIndex("by_date", (q) => q.gte("date", from)).collect().then((items) => items.filter((row) => row.tenantId === undefined)),
    });
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
    if (args.marketId && !(await enforceTenantOnResource(ctx, await ctx.db.get(args.marketId), "market"))) throw new Error("Market not found");
    const days = args.days ?? 30;
    const from = dayOf(Date.now() - days * 24 * 60 * 60 * 1000);
    const scope = await readScopedTenant(ctx);
    let snapshotRows: Doc<"subscriberSnapshots">[];
    if (!scope.enforced) {
      snapshotRows = await ctx.db.query("subscriberSnapshots").collect();
    } else {
      const tenantMarkets = args.marketId
        ? [await ctx.db.get(args.marketId)].filter((market) => market !== null)
        : await ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", scope.tenantId!)).collect();
      snapshotRows = (await Promise.all(tenantMarkets.map((market) =>
        ctx.db.query("subscriberSnapshots").withIndex("by_market_date", (q) => q.eq("marketId", market._id).gte("date", from)).collect()
      ))).flat();
    }
    const rows = snapshotRows
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
    if (args.marketId && !(await enforceTenantOnResource(ctx, await ctx.db.get(args.marketId), "market"))) throw new Error("Market not found");
    const days = args.days ?? 30;
    const from = Date.now() - days * 24 * 60 * 60 * 1000;
    const activity = await readTenantList<Doc<"agentActivity">>(ctx, {
      all: () => ctx.db.query("agentActivity").withIndex("by_time", (q) => q.gte("occurredAt", from)).collect(),
      tenant: (tenantId) => tenantActivityRows(ctx, tenantId, from),
      legacy: () => ctx.db.query("agentActivity").withIndex("by_time", (q) => q.gte("occurredAt", from)).collect().then((items) => items.filter((row) => row.tenantId === undefined)),
    });
    const filtered = args.marketId ? activity.filter((a) => a.marketId === args.marketId) : activity;
    const summary = new Map<string, { count: number; revenueLocal: number; currency: string }>();
    for (const a of filtered) {
      const entry = summary.get(a.agentId) ?? { count: 0, revenueLocal: 0, currency: a.currency };
      entry.count += 1;
      entry.revenueLocal += a.amountLocal;
      summary.set(a.agentId, entry);
    }
    const agentRows = await readTenantList<Doc<"agents">>(ctx, {
      all: () => ctx.db.query("agents").collect(),
      tenant: (tenantId) => ctx.db.query("agents").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () => ctx.db.query("agents").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    const agents = new Map(agentRows.map((a) => [a._id, a.name]));
    return Array.from(summary.entries())
      .map(([agentId, s]) => ({ agentId, agentName: agents.get(agentId as never) ?? agentId, ...s }))
      .sort((a, b) => b.revenueLocal - a.revenueLocal)
      .slice(0, args.limit ?? 10);
  },
});

export const getSalesMix = query({
  args: { days: v.optional(v.number()), marketId: v.optional(v.id("markets")) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "business_events:read");
    if (args.marketId && !(await enforceTenantOnResource(ctx, await ctx.db.get(args.marketId), "market"))) throw new Error("Market not found");
    const days = args.days ?? 30;
    const from = Date.now() - days * 24 * 60 * 60 * 1000;
    const activity = await readTenantList<Doc<"agentActivity">>(ctx, {
      all: () => ctx.db.query("agentActivity").withIndex("by_time", (q) => q.gte("occurredAt", from)).collect(),
      tenant: (tenantId) => tenantActivityRows(ctx, tenantId, from),
      legacy: () => ctx.db.query("agentActivity").withIndex("by_time", (q) => q.gte("occurredAt", from)).collect().then((items) => items.filter((row) => row.tenantId === undefined)),
    });
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
