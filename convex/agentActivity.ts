import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Thin revenue ledger (NOC spec §25). Every revenue-generating agent action —
 * voucher sale, renewal, new subscription — writes ONE row here. Everything
 * downstream (daily_snapshots, cost allocation, analytics, leaderboard) reads
 * from this ledger instead of re-scanning vouchers/commissions, which keeps
 * queries cheap and the numbers consistent.
 */
export type AgentActivityAction = "voucher_sale" | "renewal" | "new_subscription";

export async function insertActivityLedger(
  ctx: MutationCtx,
  entry: {
    agentId: string;
    marketId: string;
    action: AgentActivityAction;
    occurredAt: number;
    amountLocal: number;
    currency: string;
    planCode?: string;
    voucherId?: string;
    commissionAccruedLocal?: number;
    platformFeeLocal?: number;
  },
) {
  await ctx.db.insert("agentActivity", {
    agentId: entry.agentId as never,
    marketId: entry.marketId as never,
    action: entry.action,
    occurredAt: entry.occurredAt,
    amountLocal: entry.amountLocal,
    currency: entry.currency,
    planCode: entry.planCode,
    voucherId: entry.voucherId as never,
    commissionAccruedLocal: entry.commissionAccruedLocal,
    platformFeeLocal: entry.platformFeeLocal,
  });
}

/** Manual ledger entry for adjustments and backfills (incl. renewals that reached the platform other ways). */
export const recordActivity = mutation({
  args: {
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    action: v.union(v.literal("voucher_sale"), v.literal("renewal"), v.literal("new_subscription")),
    occurredAt: v.number(),
    amountLocal: v.number(),
    currency: v.string(),
    planCode: v.optional(v.string()),
    voucherId: v.optional(v.id("vouchers")),
    commissionAccruedLocal: v.optional(v.number()),
    platformFeeLocal: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    await insertActivityLedger(ctx, {
      agentId: args.agentId,
      marketId: args.marketId,
      action: args.action,
      occurredAt: args.occurredAt,
      amountLocal: args.amountLocal,
      currency: args.currency,
      planCode: args.planCode,
      voucherId: args.voucherId,
      commissionAccruedLocal: args.commissionAccruedLocal,
      platformFeeLocal: args.platformFeeLocal,
    });
    await logAudit(ctx, {
      action: "activity.record",
      entityTable: "agentActivity",
      entityId: args.agentId,
      changedBy: user._id,
      after: { action: args.action, amountLocal: args.amountLocal },
    });
  },
});

export const listActivityForAgent = query({
  args: { agentId: v.id("agents"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db
      .query("agentActivity")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

export const listActivityByMarket = query({
  args: { marketId: v.id("markets"), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db
      .query("agentActivity")
      .withIndex("by_market_time", (q) => q.eq("marketId", args.marketId))
      .order("desc")
      .take(args.limit ?? 50);
  },
});

/** Aggregated revenue + action counts over a window (used by analytics and the daily rollup). */
export const getActivitySummary = query({
  args: {
    from: v.number(),
    to: v.number(),
    marketId: v.optional(v.id("markets")),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const base = ctx.db.query("agentActivity").withIndex("by_time", (q) => q.gte("occurredAt", args.from)).filter((q) => q.lte(q.field("occurredAt"), args.to));
    const rows = args.marketId
      ? await base.filter((q) => q.eq(q.field("marketId"), args.marketId)).collect()
      : await base.collect();

    const byAction: Record<string, number> = {};
    const byCurrency: Record<string, number> = {};
    const byAgent: Record<string, number> = {};
    const topAgentByValue = new Map<string, number>();
    let salesCount = 0;
    let revenueLocal = 0;
    let highestAgentId: string | null = null;
    let highestAgentValue = -1;

    for (const row of rows) {
      byAction[row.action] = (byAction[row.action] ?? 0) + 1;
      byCurrency[row.currency] = (byCurrency[row.currency] ?? 0) + row.amountLocal;
      byAgent[row.agentId] = (byAgent[row.agentId] ?? 0) + 1;
      const value = (topAgentByValue.get(row.agentId) ?? 0) + row.amountLocal;
      topAgentByValue.set(row.agentId, value);
      if (value > highestAgentValue) {
        highestAgentValue = value;
        highestAgentId = row.agentId;
      }
      if (row.action === "voucher_sale" || row.action === "new_subscription") salesCount += 1;
      revenueLocal += row.amountLocal;
    }

    return {
      rows: rows.length,
      revenueLocal,
      byCurrency,
      byAction,
      topAgentsByCount: Object.entries(byAgent)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([agentId, count]) => ({ agentId, count })),
      topAgentByValue: highestAgentId,
      salesCount,
    };
  },
});