import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  assertNotSelfApproval,
  requirePlatformAdmin,
  requirePlatformOwner,
  requirePlatformUser,
} from "./lib/auth";
import { logAudit } from "./lib/auditLog";

const DISPUTE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, matches payout timeline

export const accrueCommission = mutation({
  args: {
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    voucherId: v.optional(v.id("vouchers")),
    amount: v.number(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const now = Date.now();

    const commissionId = await ctx.db.insert("commissions", {
      agentId: args.agentId,
      marketId: args.marketId,
      voucherId: args.voucherId,
      amount: args.amount,
      currency: args.currency,
      payoutStatus: "held", // enters dispute window immediately, not "accrued" limbo
      isFinalSettlement: false,
      accruedAt: now,
      disputeWindowEndsAt: now + DISPUTE_WINDOW_MS,
    });

    await logAudit(ctx, {
      action: "commission.accrue",
      entityTable: "commissions",
      entityId: commissionId,
      changedBy: user._id,
      after: { amount: args.amount, agentId: args.agentId },
    });

    return commissionId;
  },
});

/** Agent (or admin on their behalf) requests payout once the dispute window has passed. */
export const requestCommissionPayout = mutation({
  args: {
    commissionId: v.id("commissions"),
    payoutMethod: v.union(v.literal("mpesa"), v.literal("airtel_money"), v.literal("bank_transfer")),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) throw new Error("Commission not found");

    if (commission.payoutStatus !== "held") {
      throw new Error(`Cannot request payout from status "${commission.payoutStatus}"`);
    }
    if (Date.now() < commission.disputeWindowEndsAt) {
      throw new Error("Dispute window has not closed yet");
    }

    await ctx.db.patch(args.commissionId, {
      payoutStatus: "requested",
      payoutMethod: args.payoutMethod,
      requestedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "commission.requestPayout",
      entityTable: "commissions",
      entityId: args.commissionId,
      changedBy: user._id,
      after: { payoutMethod: args.payoutMethod },
    });
  },
});

/**
 * Approval step — mandatory before any payout sends, per Section 4.6.
 * An admin cannot approve a payout they themselves requested; only the
 * owner is exempt from that check (see lib/auth.assertNotSelfApproval).
 */
export const approveCommissionPayout = mutation({
  args: { commissionId: v.id("commissions"), requestedByUserId: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) throw new Error("Commission not found");
    if (commission.payoutStatus !== "requested") {
      throw new Error(`Cannot approve payout from status "${commission.payoutStatus}"`);
    }

    assertNotSelfApproval(args.requestedByUserId, user._id, user.platformRole);

    await ctx.db.patch(args.commissionId, {
      payoutStatus: "approved",
      approvedBy: user._id,
      approvedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "commission.approve",
      entityTable: "commissions",
      entityId: args.commissionId,
      changedBy: user._id,
    });
  },
});

/** Marks payout as processing — called once the M-Pesa/Airtel Money/bank transfer has actually been initiated. */
export const markCommissionProcessing = mutation({
  args: { commissionId: v.id("commissions") },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) throw new Error("Commission not found");
    if (commission.payoutStatus !== "approved") {
      throw new Error(`Cannot process payout from status "${commission.payoutStatus}"`);
    }

    await ctx.db.patch(args.commissionId, { payoutStatus: "processing" });

    await logAudit(ctx, {
      action: "commission.markProcessing",
      entityTable: "commissions",
      entityId: args.commissionId,
      changedBy: user._id,
    });
  },
});

export const markCommissionPaid = mutation({
  args: { commissionId: v.id("commissions") },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) throw new Error("Commission not found");
    if (commission.payoutStatus !== "processing") {
      throw new Error(`Cannot mark paid from status "${commission.payoutStatus}"`);
    }

    await ctx.db.patch(args.commissionId, {
      payoutStatus: "paid",
      paidAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "commission.markPaid",
      entityTable: "commissions",
      entityId: args.commissionId,
      changedBy: user._id,
    });
  },
});

/** Owner-only: mark a commission disputed, freezing it out of the normal pipeline. */
export const disputeCommission = mutation({
  args: { commissionId: v.id("commissions"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformOwner(ctx);
    await ctx.db.patch(args.commissionId, { payoutStatus: "disputed" });
    await logAudit(ctx, {
      action: "commission.dispute",
      entityTable: "commissions",
      entityId: args.commissionId,
      changedBy: user._id,
      after: { reason: args.reason },
    });
  },
});

export const listCommissionsByStatus = query({
  args: {
    payoutStatus: v.optional(
      v.union(
        v.literal("accrued"),
        v.literal("held"),
        v.literal("requested"),
        v.literal("approved"),
        v.literal("processing"),
        v.literal("paid"),
        v.literal("disputed")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    if (args.payoutStatus) {
      return await ctx.db
        .query("commissions")
        .withIndex("by_status", (q) => q.eq("payoutStatus", args.payoutStatus!))
        .collect();
    }
    return await ctx.db.query("commissions").collect();
  },
});

export const listCommissionsForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db
      .query("commissions")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
  },
});
