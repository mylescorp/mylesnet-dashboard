import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformAdmin, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import type { Id } from "./_generated/dataModel";

/**
 * Compute and store a leaderboard snapshot. Intended to run as a daily cron.
 * For each active agent, calculates:
 *   - Total sales volume and count (from voucher ownership + sold status)
 *   - Renewal count (from renewalCredits table)
 *   - Renewal rate (only where renewal data is available — never silently 0%)
 *   - Total commission earned (from commissions table)
 * Anti-gaming: renewal rate is null when data is genuinely unavailable,
 * not 0. The UI must show "N/A" rather than misranking the agent.
 */
export const computeLeaderboard = mutation({
  args: {
    snapshotDate: v.string(),
    marketId: v.optional(v.id("markets")),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const now = Date.now();

    const agents = await ctx.db
      .query("agents")
      .filter((q) =>
        q.and(
          q.eq(q.field("lifecycleStatus"), "active"),
          q.neq(q.field("status"), "deleted")
        )
      )
      .collect();

    const rankings: Array<{
      agentId: Id<"agents">;
      marketId: Id<"markets"> | undefined;
      totalSalesVolume: number;
      totalSalesCount: number;
      renewalCount: number;
      renewalRateAvailable: boolean;
      renewalRate: number | undefined;
      totalCommissionEarned: number;
      currency: "UGX" | "KSH";
    }> = [];

    for (const agent of agents) {
      const vouchers = await ctx.db
        .query("vouchers")
        .withIndex("by_owner", (q) => q.eq("ownerAgentId", agent._id))
        .collect();

      const soldVouchers = vouchers.filter(
        (v) => v.voucherStatus === "sold" || v.voucherStatus === "redeemed"
      );

      const currency = soldVouchers[0]?.marketId
        ? ((
            await ctx.db.get(soldVouchers[0].marketId)
          )?.currency ?? "UGX")
        : "UGX";

      const commissions = await ctx.db
        .query("commissions")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();

      let renewals;
      if (args.marketId) {
        renewals = await ctx.db
          .query("renewalCredits")
          .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
          .filter((q) => q.eq(q.field("marketId"), args.marketId!))
          .collect();
      } else {
        renewals = await ctx.db
          .query("renewalCredits")
          .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
          .collect();
      }

      const hasRenewalData = renewals.length > 0;
      const renewalRate = hasRenewalData && soldVouchers.length > 0
        ? renewals.length / soldVouchers.length
        : undefined;

      rankings.push({
        agentId: agent._id,
        marketId: args.marketId,
        totalSalesVolume: soldVouchers.length,
        totalSalesCount: soldVouchers.length,
        renewalCount: renewals.length,
        renewalRateAvailable: hasRenewalData,
        renewalRate,
        totalCommissionEarned: commissions.reduce((sum, c) => sum + c.amount, 0),
        currency,
      });
    }

    rankings.sort((a, b) => b.totalSalesVolume - a.totalSalesVolume);

    for (let i = 0; i < rankings.length; i++) {
      await ctx.db.insert("leaderboardSnapshots", {
        snapshotDate: args.snapshotDate,
        agentId: rankings[i].agentId,
        marketId: args.marketId,
        totalSalesVolume: rankings[i].totalSalesVolume,
        totalSalesCount: rankings[i].totalSalesCount,
        renewalCount: rankings[i].renewalCount,
        renewalRateAvailable: rankings[i].renewalRateAvailable,
        renewalRate: rankings[i].renewalRate,
        totalCommissionEarned: rankings[i].totalCommissionEarned,
        currency: rankings[i].currency,
        rank: i + 1,
        createdAt: now,
      });
    }

    await logAudit(ctx, {
      action: "leaderboard.compute",
      entityTable: "leaderboardSnapshots",
      entityId: args.snapshotDate,
      changedBy: user._id,
      after: { agentCount: rankings.length, snapshotDate: args.snapshotDate },
    });

    return { agentCount: rankings.length, snapshotDate: args.snapshotDate };
  },
});

export const getLeaderboard = query({
  args: {
    snapshotDate: v.optional(v.string()),
    marketId: v.optional(v.id("markets")),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);

    if (args.snapshotDate) {
      let snapshots = await ctx.db
        .query("leaderboardSnapshots")
        .withIndex("by_date", (q) => q.eq("snapshotDate", args.snapshotDate!))
        .collect();
      if (args.marketId) {
        snapshots = snapshots.filter((s) => s.marketId === args.marketId);
      }
      return snapshots.sort((a, b) => a.rank - b.rank);
    }

    const all = await ctx.db.query("leaderboardSnapshots").collect();
    const dates = [...new Set(all.map((s) => s.snapshotDate))].sort().reverse();
    const latestDate = dates[0];
    if (!latestDate) return [];

    let latest = all.filter((s) => s.snapshotDate === latestDate);
    if (args.marketId) {
      latest = latest.filter((s) => s.marketId === args.marketId);
    }
    return latest.sort((a, b) => a.rank - b.rank);
  },
});

export const getLatestSnapshotDate = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const latest = await ctx.db
      .query("leaderboardSnapshots")
      .order("desc")
      .first();
    return latest?.snapshotDate ?? null;
  },
});
