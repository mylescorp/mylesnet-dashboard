import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requirePermission, requirePlatformUser } from "./lib/auth";
import { dayOf } from "./lib/finance";

/**
 * Subscriber snapshot projections (spec §24 population model). Without live
 * per-market subscriber counts in the Centipid feed, the ledger is the proxy:
 *
 *   active subscribers = voucher activations still in their service window
 *     (a 45-day retention window approximates monthly plans churning monthly),
 *   new subscriptions = new_subscription ledger rows on the day,
 *   renewal rate      = renewals ÷ (renewals + new) inside the window.
 *
 * The daily rollup cron persists these; charts read `subscriberSnapshots`.
 */

const RETENTION_MS = 45 * 24 * 60 * 60 * 1000;

export const computeSubscriberSnapshot = internalMutation({
  args: { marketId: v.id("markets"), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");

    const date = args.date ?? dayOf(Date.now());
    const dayStart = new Date(`${date}T00:00:00`).getTime();
    const dayEnd = dayStart + 24 * 60 * 60 * 1000;
    const retentionStart = dayStart - RETENTION_MS;

    const dayRows = await ctx.db
      .query("agentActivity")
      .withIndex("by_market_time", (q) => q.eq("marketId", args.marketId))
      .filter((q) =>
        q.and(
          q.gte(q.field("occurredAt"), dayStart),
          q.lt(q.field("occurredAt"), dayEnd)
        )
      )
      .collect();
    const windowRows = await ctx.db
      .query("agentActivity")
      .withIndex("by_market_time", (q) => q.eq("marketId", args.marketId))
      .filter((q) =>
        q.and(
          q.gte(q.field("occurredAt"), retentionStart),
          q.lt(q.field("occurredAt"), dayEnd)
        )
      )
      .collect();

    const newCount = dayRows.filter((r) => r.action === "new_subscription").length;
    const renewalsWindow = windowRows.filter((r) => r.action === "renewal").length;
    const newWindow = windowRows.filter((r) => r.action === "new_subscription").length;
    const activeCount = Math.max(0, newWindow);
    const renewalRate = newWindow + renewalsWindow > 0 ? renewalsWindow / (newWindow + renewalsWindow) : undefined;

    const sales = windowRows.filter((r) => r.amountLocal > 0);
    const avgPlanPriceLocal =
      sales.length > 0 ? Math.round(sales.reduce((sum, r) => sum + r.amountLocal, 0) / sales.length) : undefined;

    const row = {
      marketId: args.marketId,
      date,
      activeCount,
      newCount,
      renewalCount: dayRows.filter((r) => r.action === "renewal").length,
      renewalRate,
      avgPlanPriceLocal,
      currency: market.currency,
      createdAt: Date.now(),
    };

    const existing = await ctx.db
      .query("subscriberSnapshots")
      .withIndex("by_market_date", (q) => q.eq("marketId", args.marketId).eq("date", date))
      .first();
    if (existing) {
      await ctx.db.replace(existing._id, row);
      return { updated: true, id: existing._id, ...row };
    }
    const id = await ctx.db.insert("subscriberSnapshots", row);
    return { updated: false, id, ...row };
  },
});

export const getSubscriberSnapshot = query({
  args: { marketId: v.id("markets"), date: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const date = args.date ?? dayOf(Date.now());
    const row = await ctx.db
      .query("subscriberSnapshots")
      .withIndex("by_market_date", (q) => q.eq("marketId", args.marketId).eq("date", date))
      .first();
    return row ?? null;
  },
});

export const listSubscriberTrend = query({
  args: { marketId: v.id("markets"), days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "subscriber_snapshots:read");
    const rows = await ctx.db
      .query("subscriberSnapshots")
      .withIndex("by_market_date", (q) => q.eq("marketId", args.marketId))
      .collect();
    const sorted = rows.sort((a, b) => a.date.localeCompare(b.date));
    const days = args.days ?? 30;
    return sorted.slice(-days);
  },
});