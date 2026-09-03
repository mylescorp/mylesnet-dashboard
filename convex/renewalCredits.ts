import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformAdmin, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const listRenewalCredits = query({
  args: {
    agentId: v.optional(v.id("agents")),
    marketId: v.optional(v.id("markets")),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    if (args.agentId) {
      return await ctx.db
        .query("renewalCredits")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
        .collect();
    }
    if (args.marketId) {
      return await ctx.db
        .query("renewalCredits")
        .withIndex("by_market", (q) => q.eq("marketId", args.marketId!))
        .collect();
    }
    return await ctx.db.query("renewalCredits").collect();
  },
});

export const getRenewalCreditsSummary = query({
  args: {
    agentId: v.optional(v.id("agents")),
    marketId: v.optional(v.id("markets")),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    let credits;
    if (args.agentId) {
      credits = await ctx.db
        .query("renewalCredits")
        .withIndex("by_agent", (q) => q.eq("agentId", args.agentId!))
        .collect();
    } else if (args.marketId) {
      credits = await ctx.db
        .query("renewalCredits")
        .withIndex("by_market", (q) => q.eq("marketId", args.marketId!))
        .collect();
    } else {
      credits = await ctx.db.query("renewalCredits").collect();
    }

    let totalAmount = 0;
    for (const c of credits) {
      totalAmount += c.renewalAmount;
    }

    return {
      count: credits.length,
      totalAmount,
      currency: credits[0]?.currency ?? "UGX",
    };
  },
});

/**
 * Write renewal credits from Centipid CSV reconciliation. Called by the
 * weekly reconciliation cron. Each credit links a customer phone to the
 * agent who originally acquired them via voucher redemption.
 */
export const writeRenewalCredits = mutation({
  args: {
    credits: v.array(
      v.object({
        agentId: v.id("agents"),
        marketId: v.id("markets"),
        customerPhone: v.string(),
        initialVoucherId: v.id("vouchers"),
        renewalType: v.string(),
        renewalAmount: v.number(),
        currency: v.union(v.literal("UGX"), v.literal("KSH")),
        centipidMatchRef: v.optional(v.string()),
      })
    ),
    reconciliationBatchId: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const now = Date.now();
    let written = 0;

    for (const credit of args.credits) {
      const existing = await ctx.db
        .query("renewalCredits")
        .withIndex("by_phone", (q) => q.eq("customerPhone", credit.customerPhone))
        .filter((q) => q.eq(q.field("renewalType"), credit.renewalType))
        .first();

      if (existing) continue;

      await ctx.db.insert("renewalCredits", {
        ...credit,
        reconciliationBatchId: args.reconciliationBatchId,
        creditedAt: now,
      });
      written++;
    }

    await logAudit(ctx, {
      action: "renewalCredits.reconcile",
      entityTable: "renewalCredits",
      entityId: args.reconciliationBatchId,
      changedBy: user._id,
      after: {
        batchId: args.reconciliationBatchId,
        written,
        attempted: args.credits.length,
      },
    });

    return { written, attempted: args.credits.length };
  },
});
