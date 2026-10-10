import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requirePermission, requirePlatformOwner, requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { readTenantList, enforceTenantOnResource, readScopedTenant } from "./lib/tenant";
import { localToUsd } from "./lib/finance";
import { logAudit } from "./lib/auditLog";
import { assertPayoutTransition } from "./lib/payoutLifecycleCore";

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

function withoutOtpSecret<T extends { otpHash?: string; otpCreatedAt?: number; otpVerifiedAt?: number }>(payout: T) {
  const { otpHash: _otpHash, otpCreatedAt: _otpCreatedAt, otpVerifiedAt: _otpVerifiedAt, ...safe } = payout;
  return safe;
}

function toPlatformPayoutView(
  payout: Doc<"payouts">,
  workspaceName: string,
) {
  return {
    _id: payout._id,
    workspaceName,
    payeeType: payout.payeeType,
    amountLocal: payout.amountLocal,
    currency: payout.currency,
    amountUSD: payout.amountUSD,
    method: payout.method,
    status: payout.status,
    approvalTier: payout.approvalTier,
    requestedAt: payout.requestedAt,
    approvedAt: payout.approvedAt ?? null,
    processedAt: payout.processedAt ?? null,
  };
}

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
    const scope = await readScopedTenant(ctx);
    const market = args.marketId ? await ctx.db.get(args.marketId) : null;
    if (args.marketId && !market) throw new Error("Market not found");
    if (scope.enforced && market && market.tenantId !== scope.tenantId) {
      throw new Error("Unauthorized: market is outside the active workspace");
    }
    const amountUSD = await localToUsd(ctx, args.amountLocal, args.currency);
    const id = await ctx.db.insert("payouts", {
      tenantId: scope.enforced ? scope.tenantId! : market?.tenantId,
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

/**
 * Tiered payout approval is unavailable until one-time codes can be delivered
 * through the approved communications adapter. Never expose a code to a caller.
 */
export const requestPayoutOtp = mutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payouts:manage");
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    await enforceTenantOnResource(ctx, payout, "payout");
    if (payout.approvalTier === "tier_3") await requirePlatformOwner(ctx);

    // OTPs must be delivered through the configured communications adapter.
    // This deployment has no secure delivery implementation, so never return
    // a verification code through a browser-callable mutation.
    throw new Error("Payout verification is not configured. Contact your administrator.");
  },
});

export const approvePayout = mutation({
  args: { payoutId: v.id("payouts"), otp: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "payouts:manage");
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    await enforceTenantOnResource(ctx, payout, "payout");
    if (payout.status !== "pending_approval") throw new Error("Payout is not pending approval");
    assertPayoutTransition(payout.status, "approved");

    // Self-approval guard (finance rules): a user cannot approve their own payout.
    if (payout.payeeType === "user" && payout.payeeId === user._id) {
      throw new Error("Unauthorized: cannot approve your own payout");
    }

    // Tier escalation.
    if (payout.approvalTier === "tier_3") {
      await requirePlatformOwner(ctx);
    }

    if (payout.approvalTier !== "tier_1") {
      if (!args.otp || !payout.otpHash || !payout.otpCreatedAt) throw new Error("OTP required for this approval tier");
      if (Date.now() - payout.otpCreatedAt > OTP_TTL_MS) throw new Error("OTP expired");
      const hash = await sha256Hex(args.otp);
      if (hash !== payout.otpHash) throw new Error("Invalid OTP");
    }

    await ctx.db.patch(args.payoutId, {
      status: "approved",
      approvedBy: user._id,
      approvedAt: Date.now(),
      otpHash: undefined,
      otpCreatedAt: undefined,
      otpVerifiedAt: undefined,
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
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    await enforceTenantOnResource(ctx, payout, "payout");
    assertPayoutTransition(payout.status, "processing");
    await ctx.db.patch(args.payoutId, { status: "processing" });
    await logAudit(ctx, { action: "payout.processing", entityTable: "payouts", entityId: args.payoutId, changedBy: user._id });
  },
});

export const markPayoutPaid = mutation({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "payouts:manage");
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    await enforceTenantOnResource(ctx, payout, "payout");
    assertPayoutTransition(payout.status, "paid");
    await ctx.db.patch(args.payoutId, { status: "paid", processedAt: Date.now() });
    await logAudit(ctx, { action: "payout.paid", entityTable: "payouts", entityId: args.payoutId, changedBy: user._id });
  },
});

export const rejectPayout = mutation({
  args: { payoutId: v.id("payouts"), notes: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "payouts:manage");
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    await enforceTenantOnResource(ctx, payout, "payout");
    assertPayoutTransition(payout.status, "rejected");
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
    let rows = await readTenantList<Doc<"payouts">>(ctx, {
      all: () => ctx.db.query("payouts").collect(),
      tenant: (tenantId) =>
        ctx.db.query("payouts").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("payouts").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    if (args.status) rows = rows.filter((p) => p.status === args.status!);
    return rows
      .sort((a, b) => b.requestedAt - a.requestedAt)
      .slice(0, Math.max(1, Math.min(args.limit ?? 100, 100)))
      .map(withoutOtpSecret);
  },
});

export const getPayout = query({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) throw new Error("Payout not found");
    const scoped = await enforceTenantOnResource(ctx, payout, "payout");
    return scoped ? withoutOtpSecret(scoped) : null;
  },
});

export const payoutApprovalSummary = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "payouts:read");
    const all = await readTenantList<Doc<"payouts">>(ctx, {
      all: () => ctx.db.query("payouts").collect(),
      tenant: (tenantId) =>
        ctx.db.query("payouts").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("payouts").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    const pendingAgent = all.filter((p) => p.status === "pending_approval" && p.payeeType === "agent");
    const pendingTotal = all.filter((p) => p.status === "pending_approval");
    const approvalsNeeded =
      pendingTotal.filter((p) => p.approvalTier !== "tier_1").length;
    return {
      pendingTotal: pendingTotal.length,
      pendingAgent: pendingAgent.length,
      approvalsNeeded,
    };
  },
});

/** Cross-tenant payout view for the platform finance and super-admin roles. */
export const listPlatformPayoutsPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_finance"]);
    const page = await ctx.db.query("payouts").withIndex("by_requested").order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(args.paginationOpts.numItems, 50)),
    });
    const pageRows = await Promise.all(page.page.map(async (payout) =>
      toPlatformPayoutView(
        payout,
        payout.tenantId ? (await ctx.db.get(payout.tenantId))?.name ?? "Workspace unavailable" : "Platform",
      ),
    ));
    return { ...page, page: pageRows };
  },
});

export const getPlatformPayout = query({
  args: { payoutId: v.id("payouts") },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_finance"]);
    const payout = await ctx.db.get(args.payoutId);
    if (!payout) return null;
    return toPlatformPayoutView(
      payout,
      payout.tenantId ? (await ctx.db.get(payout.tenantId))?.name ?? "Workspace unavailable" : "Platform",
    );
  },
});
