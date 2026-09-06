import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { dayOf, localToUsd } from "./lib/finance";

/**
 * Daily revenue & contribution snapshot (spec §25). Derived purely from the
 * agentActivity ledger + expenses + alerts, so the numbers always reconcile.
 * Run nightly by the crons job for every active market.
 */

function daysInMonth(date: string): number {
  const [y, m] = date.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export const buildDailySnapshot = internalMutation({
  args: { marketId: v.id("markets"), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");
    const date = args.date ?? dayOf(Date.now());
    const dayStart = new Date(`${date}T00:00:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const month = date.slice(0, 7);

    const activity = await ctx.db
      .query("agentActivity")
      .withIndex("by_market_time", (q) => q.eq("marketId", args.marketId))
      .filter((q) =>
        q.and(
          q.gte(q.field("occurredAt"), dayStart),
          q.lt(q.field("occurredAt"), dayEnd)
        )
      )
      .collect();

    let revenueLocal = 0;
    let salesCount = 0;
    let newSubscribers = 0;
    const perAgentValue = new Map<string, number>();
    let topAgentId: string | null = null;
    let topAgentValue = -1;

    for (const row of activity) {
      revenueLocal += row.amountLocal;
      if (row.action === "voucher_sale" || row.action === "new_subscription") salesCount += 1;
      if (row.action === "new_subscription") newSubscribers += 1;
      const value = (perAgentValue.get(row.agentId) ?? 0) + row.amountLocal;
      perAgentValue.set(row.agentId, value);
      if (value > topAgentValue) {
        topAgentValue = value;
        topAgentId = row.agentId;
      }
    }

    // Daily variable cost = this month's variable expenses amortised over the
    // days of the month; net contribution is revenue − amortised variable cost.
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_market_month", (q) => q.eq("marketId", args.marketId).eq("month", month))
      .collect();
    const variableMonthly = expenses.filter((e) => e.type === "variable").reduce((sum, e) => sum + e.amountLocal, 0);
    const variableCostLocal = Math.round((variableMonthly / daysInMonth(date)) * 100) / 100;

    // Uptime from the hourly rollup if present.
    const telemetry = await ctx.db
      .query("telemetryDaily")
      .withIndex("by_market_date", (q) => q.eq("marketId", args.marketId).eq("date", date))
      .collect();
    let avgUptimePercent: number | undefined;
    if (telemetry.length > 0) {
      // Approximate uptime from sample link health is not stored directly;
      // use CPU/CCQ health as a proxy for "healthy service".
      const cpuValues = telemetry.map((t) => t.avgCpuPercent).filter((c): c is number => c !== undefined);
      avgUptimePercent =
        cpuValues.length > 0 ? Math.round((1 - cpuValues.filter((c) => c >= 90).length / cpuValues.length) * 10000) / 100 : undefined;
    }

    const activeAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_market_status", (q) => q.eq("marketId", args.marketId).eq("alertStatus", "open"))
      .collect();
    const activeAlertsCount = activeAlerts.length;

    const revenueUSD = await localToUsd(ctx, revenueLocal, market.currency, date);

    const row = {
      marketId: args.marketId,
      date,
      revenueLocal,
      revenueUSD,
      salesCount,
      newSubscribers,
      variableCostLocal,
      netContributionLocal: Math.round((revenueLocal - variableCostLocal) * 100) / 100,
      avgUptimePercent,
      activeAlertsCount,
      topAgentId: topAgentId as never,
      currency: market.currency,
      createdAt: Date.now(),
    };

    const existing = await ctx.db
      .query("dailySnapshots")
      .withIndex("by_market_date", (q) => q.eq("marketId", args.marketId).eq("date", date))
      .first();
    if (existing) {
      await ctx.db.replace(existing._id, row);
      return { updated: true, id: existing._id, ...row };
    }
    const id = await ctx.db.insert("dailySnapshots", row);
    return { updated: false, id, ...row };
  },
});

export const getDailySnapshot = query({
  args: { marketId: v.id("markets"), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "financials:read");
    const row = await ctx.db
      .query("dailySnapshots")
      .withIndex("by_market_date", (q) => q.eq("marketId", args.marketId).eq("date", args.date ?? dayOf(Date.now())))
      .first();
    return row ?? null;
  },
});

export const listDailySnapshots = query({
  args: { marketId: v.id("markets"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "financials:read");
    const rows = await ctx.db
      .query("dailySnapshots")
      .withIndex("by_market_date", (q) => q.eq("marketId", args.marketId))
      .collect();
    return rows.sort((a, b) => a.date.localeCompare(b.date)).slice(-(args.days ?? 30));
  },
});