import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePlatformAdmin, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/** Simple mod-97 style checksum so guessed/tampered codes are rejected without a DB lookup. */
function computeChecksum(code: string): string {
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    sum = (sum * 31 + code.charCodeAt(i)) % 97;
  }
  return sum.toString().padStart(2, "0");
}

function generateVoucherCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

const EXPIRY_WINDOW_MS = {
  half_day: 3 * 24 * 60 * 60 * 1000,
  day: 7 * 24 * 60 * 60 * 1000,
  week: 21 * 24 * 60 * 60 * 1000,
  month: 60 * 24 * 60 * 60 * 1000,
  specialty: 30 * 24 * 60 * 60 * 1000,
} as const;

export const listBatches = query({
  args: { marketId: v.optional(v.id("markets")) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const rows = args.marketId
      ? await ctx.db
          .query("voucherBatches")
          .withIndex("by_market", (idx) => idx.eq("marketId", args.marketId!))
          .collect()
      : await ctx.db.query("voucherBatches").collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const listVouchersForBatch = query({
  args: { batchId: v.id("voucherBatches") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db
      .query("vouchers")
      .withIndex("by_batch", (q) => q.eq("batchId", args.batchId))
      .collect();
  },
});

export const generateVoucherBatch = mutation({
  args: {
    marketId: v.id("markets"),
    planType: v.union(
      v.literal("half_day"),
      v.literal("day"),
      v.literal("week"),
      v.literal("month"),
      v.literal("specialty")
    ),
    quantity: v.number(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
    priceEach: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const now = Date.now();

    const batchId = await ctx.db.insert("voucherBatches", {
      marketId: args.marketId,
      planType: args.planType,
      quantity: args.quantity,
      currency: args.currency,
      priceEach: args.priceEach,
      generatedBy: user._id,
      createdAt: now,
    });

    const expiresAt = now + EXPIRY_WINDOW_MS[args.planType];

    for (let i = 0; i < args.quantity; i++) {
      const code = generateVoucherCode();
      await ctx.db.insert("vouchers", {
        batchId,
        marketId: args.marketId,
        code,
        checksum: computeChecksum(code),
        voucherStatus: "unallocated",
        expiresAt,
      });
    }

    await logAudit(ctx, {
      action: "voucherBatch.generate",
      entityTable: "voucherBatches",
      entityId: batchId,
      changedBy: user._id,
      after: { quantity: args.quantity, planType: args.planType },
    });

    return batchId;
  },
});

/** Reject a voucher code whose checksum doesn't match — guessed/tampered codes never validate. */
export const validateVoucherCode = query({
  args: { code: v.string(), checksum: v.string() },
  handler: async (ctx, args) => {
    const expected = computeChecksum(args.code);
    if (expected !== args.checksum) {
      return { valid: false, reason: "checksum_mismatch" };
    }
    const voucher = await ctx.db
      .query("vouchers")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    if (!voucher) return { valid: false, reason: "not_found" };
    return { valid: true, voucher };
  },
});

export const allocateVoucherToAgent = mutation({
  args: { voucherId: v.id("vouchers"), agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    await ctx.db.patch(args.voucherId, {
      ownerAgentId: args.agentId,
      voucherStatus: "owned",
    });
    await logAudit(ctx, {
      action: "voucher.allocate",
      entityTable: "vouchers",
      entityId: args.voucherId,
      changedBy: user._id,
      after: { agentId: args.agentId },
    });
  },
});

const DISPUTE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export const markVoucherSold = mutation({
  args: { voucherId: v.id("vouchers") },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) throw new Error("Voucher not found");

    const now = Date.now();
    await ctx.db.patch(args.voucherId, {
      voucherStatus: "sold",
      soldAt: now,
    });

    if (voucher.ownerAgentId) {
      const assignment = await ctx.db
        .query("agentMarketAssignments")
        .withIndex("by_agent_status", (q) =>
          q.eq("agentId", voucher.ownerAgentId!).eq("assignmentStatus", "active")
        )
        .filter((q) => q.eq(q.field("marketId"), voucher.marketId))
        .first();

      if (assignment) {
        const batch = await ctx.db.get(voucher.batchId);
        if (batch) {
          const commissionAmount = batch.priceEach * assignment.commissionRate;
          if (commissionAmount > 0) {
            await ctx.db.insert("commissions", {
              agentId: voucher.ownerAgentId,
              marketId: voucher.marketId,
              voucherId: voucher._id,
              amount: commissionAmount,
              currency: batch.currency,
              payoutStatus: "held",
              isFinalSettlement: false,
              accruedAt: now,
              disputeWindowEndsAt: now + DISPUTE_WINDOW_MS,
            });
          }
        }
      }
    }

    await logAudit(ctx, {
      action: "voucher.markSold",
      entityTable: "vouchers",
      entityId: args.voucherId,
      changedBy: user._id,
    });
  },
});

/**
 * Redemption — the ONLY point where a customer phone number is captured,
 * per Section 4.7. This builds the permanent customer-to-agent link used
 * for weekly Centipid CSV reconciliation. Whether that reconciliation ever
 * populates renewalCredits depends entirely on whether Centipid's export
 * contains a matching identifier — still unverified as of this build
 * (see decisions.md). The field is optional here specifically so the
 * system degrades gracefully rather than assuming.
 */
export const redeemVoucher = mutation({
  args: {
    voucherId: v.id("vouchers"),
    customerPhoneAtRedemption: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) throw new Error("Voucher not found");
    if (voucher.voucherStatus === "redeemed") {
      throw new Error("Voucher already redeemed");
    }
    if (voucher.voucherStatus === "expired") {
      throw new Error("Voucher has expired");
    }

    await ctx.db.patch(args.voucherId, {
      voucherStatus: "redeemed",
      redeemedAt: Date.now(),
      customerPhoneAtRedemption: args.customerPhoneAtRedemption,
    });

    await logAudit(ctx, {
      action: "voucher.redeem",
      entityTable: "vouchers",
      entityId: args.voucherId,
      changedBy: user._id,
      after: { hasCustomerPhone: args.customerPhoneAtRedemption !== undefined },
    });
  },
});

/**
 * Expiry sweep — run on a schedule (cron). Unsold vouchers revert to the
 * owning agent's pool as "expired", never vanish silently.
 */
export const sweepExpiredVouchers = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const candidates = await ctx.db
      .query("vouchers")
      .withIndex("by_status", (q) => q.eq("voucherStatus", "owned"))
      .collect();

    let expiredCount = 0;
    for (const voucher of candidates) {
      if (voucher.expiresAt <= now) {
        await ctx.db.patch(voucher._id, { voucherStatus: "expired" });
        expiredCount++;
      }
    }
    return { expiredCount };
  },
});

export const listVouchersForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db
      .query("vouchers")
      .withIndex("by_owner", (q) => q.eq("ownerAgentId", args.agentId))
      .collect();
  },
});
