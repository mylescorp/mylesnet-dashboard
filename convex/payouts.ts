import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireFinanceOrAbove, requirePermission, requirePlatformOwner, requirePlatformUser } from "./lib/auth";
import { localToUsd } from "./lib/finance";
import { logAudit } from "./lib/auditLog";

/**
 * Withdrawals & payouts (spec §27 finance rules):
 *   tier_1  < $100       — finance_manager can approve
 *   tier_2  $100–$1,000  — finance_manager + OTP
 *   tier_3  > $1,000     — requires platform_owner and OTP
 * Self-approval of your own payout is always blocked unless you are the owner.
 */

export type ApprovalTier = "tier_1" | "tier_2" | "tier_3";

export function tierForAmountUsd(amountUSD: number): ApprovalTier {
  if (amountUSD > 1000) return "tier_3";
  if (amountUSD >= 100) return "tier_2";
  return "tier_1";
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const OTP_TTL_MS = 10 * 60 * 1000;

export const createPayoutRequest = mutation({
  args: {
    type: v.string(),
    payeeType: v.union(v.literal("user"), v.literal("agent"), v.literal("investor"), v.literal("vendor")),
    payeeId: v.string(),
    marketId: v.optional(v.id("markets")),
    amountLocal: v.number(),
    currency: v.string(),
    method: v.union(v.literal("mpesa"), v.literal("airtel_money"), v.literal("bank_transfer"), v.literal("stripe")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "payouts:manage");
    if (args.amountLocal <= 0) throw new Error("Amount must be positive");
    const amountUSD = await localToUsd(ctx, args.amountLocal, args.currency);
    const id = await ctx.db.insert("payouts", {
      type: args.type,
      payeeType: args.payeeType,
      payeeId: args.payeeId,
      marketId: args.marketId,
      amountLocal: args.amountLocal,
      currency: args.currency,
      amountUSD,
      method: args.method,
      status: "pending_approval",
      approvalTier: tierForAmountUsd(amountUSD),
      requestedBy: user._id,
      requestedAt: Date.now(),
      notes: args.notes,
    });
    await logAudit(ctx, {
      action: "payout.request",
      entityTable: "payouts",
      entityId: id,
      changedBy: user._id,
      after: { amountUSD, tier: tierForAmountUsd(amountUSD) },
    });
    return id;
  },
});

/** Generate a single-use OTP for approving a payout. SHA-256 hash stored. */
export const requestPayoutOtp = mutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, args) => {
    // Any finance-role user may generate for tier_1/2; tier_3 owners only.
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    const user =
      payout.approvalTier === "tier_3"
        ? await requirePlatformOwner(ctx)
        : await requirePermission(ctx, "payouts:manage");

    const code = String(Math.floor(100000 + Math.random() * 900000));
    await ctx.db.patch(args.payoutId, {
      otpHash: await sha256Hex(code),
      otpVerifiedAt: undefined,
    });
    await logAudit(ctx, {
      action: "payout.otpGenerated",
      entityTable: "payouts",
      entityId: args.payoutId,
      changedBy: user._id,
    });
    // Returned once. In production this is delivered via SMS/email (lib/notify)
    // instead of surfaced in the UI.
    return { otp: code, expiresInMs: OTP_TTL_MS };
  },
});

export const approvePayout = mutation({
  args: { payoutId: v.id("payouts"), otp: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "payouts:manage");
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    if (payout.status !== "pending_approval") throw new Error("Payout is not pending approval");

    // Self-approval guard (finance rules): a user cannot approve their own payout.
    if (payout.payeeType === "user" && payout.payeeId === user._id) {
      throw new Error("Unauthorized: cannot approve your own payout");
    }

    // Tier escalation.
    if (payout.approvalTier === "tier_3") {
      await requirePlatformOwner(ctx);
    }

    if (payout.approvalTier !== "tier_1") {
      if (!args.otp || !payout.otpHash) throw new Error("OTP required for this approval tier");
      const hash = await sha256Hex(args.otp);
      if (hash !== payout.otpHash) throw new Error("Invalid OTP");
      if (payout.otpVerifiedAt && Date.now() - payout.otpVerifiedAt > OTP_TTL_MS) {
        throw new Error("OTP expired");
      }
      await ctx.db.patch(args.payoutId, { otpVerifiedAt: Date.now() });
    }

    await ctx.db.patch(args.payoutId, {
      status: "approved",
      approvedBy: user._id,
      approvedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "payout.approve",
      entityTable: "payouts",
      entityId: args.payoutId,
      changedBy: user._id,
    });
  },
});

export const markPayoutProcessing = mutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "payouts:manage");
    await ctx.db.patch(args.payoutId, { status: "processing" });
    await logAudit(ctx, { action: "payout.processing", entityTable: "payouts", entityId: args.payoutId, changedBy: user._id });
  },
});

export const markPayoutPaid = mutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "payouts:manage");
    await ctx.db.patch(args.payoutId, { status: "paid", processedAt: Date.now() });
    await logAudit(ctx, { action: "payout.paid", entityTable: "payouts", entityId: args.payoutId, changedBy: user._id });
  },
});

export const rejectPayout = mutation({
  args: { payoutId: v.id("payouts"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "payouts:manage");
    await ctx.db.patch(args.payoutId, { status: "rejected", notes: args.notes });
    await logAudit(ctx, { action: "payout.reject", entityTable: "payouts", entityId: args.payoutId, changedBy: user._id });
  },
});

export const listPayouts = query({
  args: {
    status: v.optional(v.union(v.literal("pending_approval"), v.literal("approved"), v.literal("processing"), v.literal("paid"), v.literal("rejected"))),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payouts:read");
    const rows = args.status
      ? await ctx.db.query("payouts").withIndex("by_status", (q) => q.eq("status", args.status!)).collect()
      : await ctx.db.query("payouts").collect();
    return rows.sort((a, b) => b.requestedAt - a.requestedAt).slice(0, args.limit ?? 100);
  },
});

export const getPayout = query({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    return payout;
  },
});

export const payoutApprovalSummary = query({
  args: {},
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payouts:read");
    const all = await ctx.db.query("payouts").collect();
    const pendingAgent = all.filter((p) => p.status === "pending_approval" && p.payeeType === "agent");
    const pendingTotal = all.filter((p) => p.status === "pending_approval");
    const approvalsNeeded =
      pendingTotal.filter((p) => p.approvalTier !== "tier_1").length;
    return { pendingTotal, pendingAgent, approvalsNeeded };
  },
});

// Re-exported for the scheduled payout settlement job (spec: nightly sweep sets
// approved -> processing, processing -> paid after provider confirmation).
export const autoAdvancePayouts = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const approved = await ctx.db.query("payouts").withIndex("by_status", (q) => q.eq("status", "approved")).collect();
    let advanced = 0;
    for (const payout of approved) {
      // Providers settle in minutes, not instantly; require some confirmation
      // window before flagging as processing.
      if (payout.approvedAt && now - payout.approvedAt >= 5 * 60 * 1000) {
        await ctx.db.patch(payout._id, { status: "processing" });
        advanced += 1;
      }
    }
    return { advanced };
  },
});