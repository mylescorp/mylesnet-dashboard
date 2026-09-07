import { v } from "convex/values";
import { mutation, query, internalQuery } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const getAgentInternal = internalQuery({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
  },
});

export const listAgents = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "agents:read");
    return await ctx.db
      .query("agents")
      .filter((q) => q.neq(q.field("status"), "deleted"))
      .collect();
  },
});

export const getAgent = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "agents:read");
    return await ctx.db.get(args.agentId);
  },
});

/** Resume-style timeline of all past and current assignments for one agent. */
export const getAgentAssignmentHistory = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "agents:read");
    const rows = await ctx.db
      .query("agentMarketAssignments")
      .withIndex("by_agent", (q) => q.eq("agentId", args.agentId))
      .collect();
    return rows.sort((a, b) => b.startedAt - a.startedAt);
  },
});

export const createAgent = mutation({
  args: { name: v.string(), phone: v.string(), email: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "agents:manage");
    const now = Date.now();
    const agentId = await ctx.db.insert("agents", {
      name: args.name,
      phone: args.phone,
      email: args.email,
      lifecycleStatus: "active",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "agent.create",
      entityTable: "agents",
      entityId: agentId,
      changedBy: user._id,
      after: { name: args.name },
    });
    return agentId;
  },
});

/**
 * Assign an agent to a market. If the agent already has an active assignment
 * to a DIFFERENT market and `endPrevious` is true, that row is closed first
 * (close-and-open pattern) rather than mutated. Multi-market agents keep
 * both rows active if `endPrevious` is false.
 */
export const assignAgentToMarket = mutation({
  args: {
    agentId: v.id("agents"),
    marketId: v.id("markets"),
    compensationType: v.union(
      v.literal("commission_only"),
      v.literal("salary_plus_commission")
    ),
    commissionRate: v.number(),
    endPreviousAssignmentId: v.optional(v.id("agentMarketAssignments")),
    endReason: v.optional(
      v.union(
        v.literal("reassigned"),
        v.literal("demoted"),
        v.literal("promoted"),
        v.literal("other")
      )
    ),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "agents:manage");
    const now = Date.now();

    if (args.endPreviousAssignmentId) {
      const prev = await ctx.db.get(args.endPreviousAssignmentId);
      if (!prev) throw new Error("Previous assignment not found");
      await ctx.db.patch(args.endPreviousAssignmentId, {
        assignmentStatus: "ended",
        endedAt: now,
        endReason: args.endReason ?? "reassigned",
      });
    }

    const assignmentId = await ctx.db.insert("agentMarketAssignments", {
      agentId: args.agentId,
      marketId: args.marketId,
      assignmentStatus: "active",
      compensationType: args.compensationType,
      commissionRate: args.commissionRate,
      startedAt: now,
    });

    await logAudit(ctx, {
      action: "agent.assignToMarket",
      entityTable: "agentMarketAssignments",
      entityId: assignmentId,
      changedBy: user._id,
      after: { agentId: args.agentId, marketId: args.marketId },
    });

    return assignmentId;
  },
});

/** Suspend: reversible, freezes voucher pool, no cascading effects. */
export const suspendAgent = mutation({
  args: { agentId: v.id("agents"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "agents:manage");
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    await ctx.db.patch(args.agentId, {
      lifecycleStatus: "suspended",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "agent.suspend",
      entityTable: "agents",
      entityId: args.agentId,
      changedBy: user._id,
      before: { lifecycleStatus: agent.lifecycleStatus },
      after: { lifecycleStatus: "suspended", reason: args.reason },
    });
  },
});

export const reactivateAgent = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "agents:manage");
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    await ctx.db.patch(args.agentId, {
      lifecycleStatus: "active",
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "agent.reactivate",
      entityTable: "agents",
      entityId: args.agentId,
      changedBy: user._id,
      before: { lifecycleStatus: agent.lifecycleStatus },
      after: { lifecycleStatus: "active" },
    });
  },
});

/**
 * Offboarding wizard — step 1 of the multi-step flow described in Section
 * 4.4. This mutation performs steps 1, 4, and 5 (close assignments, revoke
 * access, mark terminated). Steps 2 (voucher disposition) and 3 (final
 * settlement) are separate mutations below, called by the wizard UI in
 * sequence, since each requires a human choice per voucher batch and
 * routes through the standard commission approval flow.
 */
export const offboardAgentStep1CloseAssignments = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "agents:manage");
    const now = Date.now();

    const activeAssignments = await ctx.db
      .query("agentMarketAssignments")
      .withIndex("by_agent_status", (q) =>
        q.eq("agentId", args.agentId).eq("assignmentStatus", "active")
      )
      .collect();

    for (const assignment of activeAssignments) {
      await ctx.db.patch(assignment._id, {
        assignmentStatus: "ended",
        endedAt: now,
        endReason: "terminated",
      });
    }

    await logAudit(ctx, {
      action: "agent.offboard.closeAssignments",
      entityTable: "agents",
      entityId: args.agentId,
      changedBy: user._id,
      after: { closedCount: activeAssignments.length },
    });

    return { closedAssignments: activeAssignments.length };
  },
});

/** Surfaces every unsold voucher owned by the agent, grouped by batch, for the disposition step. */
export const getAgentUnsoldVouchersForOffboarding = query({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "agents:manage");
    return await ctx.db
      .query("vouchers")
      .withIndex("by_owner", (q) => q.eq("ownerAgentId", args.agentId))
      .filter((q) =>
        q.or(
          q.eq(q.field("voucherStatus"), "owned"),
          q.eq(q.field("voucherStatus"), "unallocated")
        )
      )
      .collect();
  },
});

/** Step 2: explicit per-voucher choice — reassign to a named agent, or return to pool. */
export const disposeOffboardingVoucher = mutation({
  args: {
    voucherId: v.id("vouchers"),
    disposition: v.union(v.literal("reassign"), v.literal("returnToPool")),
    newOwnerAgentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "agents:manage");
    if (args.disposition === "reassign" && !args.newOwnerAgentId) {
      throw new Error("newOwnerAgentId is required when reassigning");
    }

    await ctx.db.patch(args.voucherId, {
      ownerAgentId: args.disposition === "reassign" ? args.newOwnerAgentId : undefined,
      voucherStatus: "unallocated",
    });

    await logAudit(ctx, {
      action: "voucher.offboardingDisposition",
      entityTable: "vouchers",
      entityId: args.voucherId,
      changedBy: user._id,
      after: { disposition: args.disposition, newOwnerAgentId: args.newOwnerAgentId },
    });
  },
});

/**
 * Step 3 + 4 + 5: final settlement (routed through the standard commission
 * approval flow — see commissions.ts), revoke access, and mark terminated.
 * Soft delete only — historical sales/leaderboard attribution stays intact.
 */
export const offboardAgentFinalize = mutation({
  args: {
    agentId: v.id("agents"),
    finalSettlementAmount: v.number(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
    marketId: v.id("markets"),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "agents:manage");
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    const now = Date.now();

    // Final settlement enters the same accrue -> hold -> approve -> paid
    // pipeline as a normal commission, per Section 4.4 step 3.
    await ctx.db.insert("commissions", {
      agentId: args.agentId,
      marketId: args.marketId,
      amount: args.finalSettlementAmount,
      currency: args.currency,
      payoutStatus: "accrued",
      isFinalSettlement: true,
      accruedAt: now,
      disputeWindowEndsAt: now + 30 * 24 * 60 * 60 * 1000,
    });

    await ctx.db.patch(args.agentId, {
      lifecycleStatus: "terminated",
      terminatedAt: now,
      status: "deleted", // soft delete only — history is preserved
      deletedAt: now,
      deletedBy: user._id,
      deleteReason: "Offboarded",
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "agent.offboard.finalize",
      entityTable: "agents",
      entityId: args.agentId,
      changedBy: user._id,
      after: { finalSettlementAmount: args.finalSettlementAmount },
    });

    // NOTE: revoking the WorkOS session and clearing __mylesnet_* cookies
    // happens in the HTTP layer / API route that calls this mutation, since
    // Convex functions cannot touch cookies directly.
  },
});

export const restoreAgent = mutation({
  args: { agentId: v.id("agents") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "agents:manage");
    const agent = await ctx.db.get(args.agentId);
    if (!agent) throw new Error("Agent not found");

    // Restoring an agent restores full history including unpaid commission
    // balance exactly as it was — delete/restore never touches financial state.
    await ctx.db.patch(args.agentId, {
      status: "active",
      lifecycleStatus: "active",
      restoredAt: Date.now(),
      restoredBy: user._id,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "agent.restore",
      entityTable: "agents",
      entityId: args.agentId,
      changedBy: user._id,
    });
  },
});
