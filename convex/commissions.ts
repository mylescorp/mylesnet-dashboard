import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import {
  assertNotSelfApproval,
  requirePermission,
  requirePlatformOwner,
  requirePlatformUser,
  requirePlatformSubRole,
} from "./lib/auth";
import { enforceTenantOnResource, readScopedTenant, readTenantList } from "./lib/tenant";
import { logAudit } from "./lib/auditLog";
import { paginationOptsValidator } from "convex/server";
import { commissionTenantId } from "./lib/commissionScopeCore";

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
    const user = await requirePermission(ctx, "commissions:manage");
    if (!(args.amount > 0 && Number.isFinite(args.amount))) throw new Error("Commission amount must be positive.");
    const agent = await ctx.db.get(args.agentId);
    const market = await ctx.db.get(args.marketId);
    if (!agent || !market) throw new Error("Agent or market is unavailable.");
    const voucher = args.voucherId ? await ctx.db.get(args.voucherId) : null;
    if (args.voucherId && !voucher) throw new Error("Voucher is unavailable.");
    const scope = await readScopedTenant(ctx);
    await enforceTenantOnResource(ctx, agent, "agent");
    await enforceTenantOnResource(ctx, market, "market");
    if (voucher) {
      await enforceTenantOnResource(ctx, voucher, "voucher");
      if (voucher.marketId !== args.marketId) throw new Error("Voucher is outside the selected market.");
    }
    const activeAssignment = await ctx.db
      .query("agentMarketAssignments")
      .withIndex("by_agent_status", (q) => q.eq("agentId", args.agentId).eq("assignmentStatus", "active"))
      .filter((q) => q.eq(q.field("marketId"), args.marketId))
      .first();
    const tenantId = commissionTenantId({
      agentTenantId: agent.tenantId,
      marketTenantId: market.tenantId,
      activeAssignmentMatches: activeAssignment !== null,
      authenticatedTenantId: scope.enforced ? scope.tenantId : undefined,
    });
    const now = Date.now();

    const commissionId = await ctx.db.insert("commissions", {
      tenantId: tenantId as typeof market.tenantId,
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
    await enforceTenantOnResource(ctx, commission, "commission");

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
    const user = await requirePermission(ctx, "commissions:manage");
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) throw new Error("Commission not found");
    await enforceTenantOnResource(ctx, commission, "commission");
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
    const user = await requirePermission(ctx, "commissions:manage");
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) throw new Error("Commission not found");
    await enforceTenantOnResource(ctx, commission, "commission");
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
    const user = await requirePermission(ctx, "commissions:manage");
    const commission = await ctx.db.get(args.commissionId);
    if (!commission) throw new Error("Commission not found");
    await enforceTenantOnResource(ctx, commission, "commission");
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
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_finance", "platform_ops"]);
    let rows = await readTenantList<Doc<"commissions">>(ctx, {
      all: () => ctx.db.query("commissions").collect(),
      tenant: (tenantId) =>
        ctx.db.query("commissions").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("commissions").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    if (args.payoutStatus) rows = rows.filter((c) => c.payoutStatus === args.payoutStatus!);
    return rows.sort((a, b) => b.accruedAt - a.accruedAt).slice(0, 100);
  },
});

export const listCommissionsForAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_finance", "platform_ops"]);
    const rows = await readTenantList<Doc<"commissions">>(ctx, {
      all: () => ctx.db.query("commissions").collect(),
      tenant: (tenantId) =>
        ctx.db.query("commissions").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("commissions").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    return rows.filter((c) => c.agentId === args.agentId);
  },
});

export const listPlatformCommissionsPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_finance", "platform_ops"]);
    const page = await ctx.db.query("commissions").withIndex("by_accruedAt").order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(args.paginationOpts.numItems, 50)),
    });
    const pageRows = await Promise.all(page.page.map(async (commission) => {
      const [agent, market] = await Promise.all([
        ctx.db.get(commission.agentId),
        ctx.db.get(commission.marketId),
      ]);
      return {
        _id: commission._id,
        agentName: agent?.name ?? "Agent unavailable",
        marketName: market?.name ?? "Market unavailable",
        amount: commission.amount,
        currency: commission.currency,
        payoutStatus: commission.payoutStatus,
        isFinalSettlement: commission.isFinalSettlement,
        accruedAt: commission.accruedAt,
        disputeWindowEndsAt: commission.disputeWindowEndsAt,
        requestedAt: commission.requestedAt ?? null,
        approvedAt: commission.approvedAt ?? null,
        paidAt: commission.paidAt ?? null,
      };
    }));
    return { ...page, page: pageRows };
  },
});
