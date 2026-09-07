import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const listMarkets = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "markets:read");
    return await ctx.db
      .query("markets")
      .filter((q) => q.neq(q.field("status"), "deleted"))
      .collect();
  },
});

export const getMarket = query({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "markets:read");
    return await ctx.db.get(args.marketId);
  },
});

export const createMarket = mutation({
  args: {
    name: v.string(),
    country: v.string(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "markets:manage");
    const now = Date.now();
    const marketId = await ctx.db.insert("markets", {
      name: args.name,
      country: args.country,
      currency: args.currency,
      lifecycleStatus: "planned",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "market.create",
      entityTable: "markets",
      entityId: marketId,
      changedBy: user._id,
      after: { name: args.name, country: args.country },
    });
    return marketId;
  },
});

export const updateMarketLifecycleStatus = mutation({
  args: {
    marketId: v.id("markets"),
    lifecycleStatus: v.union(
      v.literal("planned"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("decommissioned")
    ),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "markets:manage");
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");

    await ctx.db.patch(args.marketId, {
      lifecycleStatus: args.lifecycleStatus,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "market.statusChange",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: user._id,
      before: { lifecycleStatus: market.lifecycleStatus },
      after: { lifecycleStatus: args.lifecycleStatus },
    });
  },
});

/**
 * Soft delete. Cascading dependents (active devices/agents assigned to this
 * market) must be surfaced to the caller BEFORE this runs — the calling UI
 * is responsible for the "reassign or delete together" wizard per Section
 * 4.9. This mutation refuses to run if active dependents exist, forcing
 * that choice rather than silently orphaning anything.
 */
export const softDeleteMarket = mutation({
  args: {
    marketId: v.id("markets"),
    deleteReason: v.string(),
    forceCascade: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "markets:manage");
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");

    const activeDevices = await ctx.db
      .query("devices")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .filter((q) => q.neq(q.field("status"), "deleted"))
      .collect();

    const activeAssignments = await ctx.db
      .query("agentMarketAssignments")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .filter((q) => q.eq(q.field("assignmentStatus"), "active"))
      .collect();

    if ((activeDevices.length > 0 || activeAssignments.length > 0) && !args.forceCascade) {
      throw new Error(
        `This market has ${activeDevices.length} active device(s) and ${activeAssignments.length} active agent assignment(s). ` +
          `Choose to soft-delete all dependents together (forceCascade: true) or reassign them first.`
      );
    }

    const now = Date.now();

    if (args.forceCascade) {
      for (const device of activeDevices) {
        await ctx.db.patch(device._id, {
          status: "deleted",
          lifecycleStatus: "deleted",
          deletedAt: now,
          deletedBy: user._id,
          deleteReason: `Cascaded from market deletion: ${args.deleteReason}`,
        });
      }
      for (const assignment of activeAssignments) {
        await ctx.db.patch(assignment._id, {
          assignmentStatus: "ended",
          endedAt: now,
          endReason: "other",
        });
      }
    }

    await ctx.db.patch(args.marketId, {
      status: "deleted",
      deletedAt: now,
      deletedBy: user._id,
      deleteReason: args.deleteReason,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "market.softDelete",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: user._id,
      before: { status: market.status },
      after: { status: "deleted", cascaded: !!args.forceCascade },
    });
  },
});

export const restoreMarket = mutation({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "markets:manage");
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");

    // Restoring does NOT auto-reactivate whatever was reassigned away while
    // it was gone — that is a deliberate follow-up step, per Section 4.9.
    await ctx.db.patch(args.marketId, {
      status: "active",
      restoredAt: Date.now(),
      restoredBy: user._id,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "market.restore",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: user._id,
    });
  },
});

/**
 * Monthly operating cost entry. Missing months must show as a visible gap
 * in break-even calculations, never silently defaulted to last month.
 */
export const reportOperatingCost = mutation({
  args: {
    marketId: v.id("markets"),
    yearMonth: v.string(), // "2026-09"
    airtelDataCost: v.number(),
    electricityCost: v.number(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "markets:manage");
    const existing = await ctx.db
      .query("marketOperatingCosts")
      .withIndex("by_market_month", (q) =>
        q.eq("marketId", args.marketId).eq("yearMonth", args.yearMonth)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        airtelDataCost: args.airtelDataCost,
        electricityCost: args.electricityCost,
        currency: args.currency,
        reportedBy: user._id,
        reportedAt: Date.now(),
      });
      await logAudit(ctx, {
        action: "market.costUpdate",
        entityTable: "marketOperatingCosts",
        entityId: existing._id,
        changedBy: user._id,
        after: { yearMonth: args.yearMonth },
      });
      return existing._id;
    }

    const costId = await ctx.db.insert("marketOperatingCosts", {
      marketId: args.marketId,
      yearMonth: args.yearMonth,
      airtelDataCost: args.airtelDataCost,
      electricityCost: args.electricityCost,
      currency: args.currency,
      reportedBy: user._id,
      reportedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "market.costReport",
      entityTable: "marketOperatingCosts",
      entityId: costId,
      changedBy: user._id,
      after: { yearMonth: args.yearMonth },
    });
    return costId;
  },
});

/** Monthly operating-cost entries for one market, newest first. */
export const listOperatingCosts = query({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "markets:read");
    const rows = await ctx.db
      .query("marketOperatingCosts")
      .withIndex("by_market_month", (q) => q.eq("marketId", args.marketId))
      .collect();
    return rows.sort((a, b) => b.yearMonth.localeCompare(a.yearMonth));
  },
});

/** Flags markets missing a cost entry for the given month — for the platform dashboard action-item card. */
export const listMarketsMissingCostEntry = query({
  args: { yearMonth: v.string() },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "markets:read");
    const markets = await ctx.db
      .query("markets")
      .filter((q) => q.eq(q.field("lifecycleStatus"), "active"))
      .collect();

    const missing = [];
    for (const market of markets) {
      const entry = await ctx.db
        .query("marketOperatingCosts")
        .withIndex("by_market_month", (q) =>
          q.eq("marketId", market._id).eq("yearMonth", args.yearMonth)
        )
        .first();
      if (!entry) missing.push(market);
    }
    return missing;
  },
});

/** Check staffing status for a specific market — returns active agent count and assignment details. */
export const getMarketStaffingStatus = query({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "markets:read");
    const assignments = await ctx.db
      .query("agentMarketAssignments")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .filter((q) => q.eq(q.field("assignmentStatus"), "active"))
      .collect();

    const agentDetails = [];
    for (const assignment of assignments) {
      const agent = await ctx.db.get(assignment.agentId);
      if (agent) {
        agentDetails.push({
          agentId: agent._id,
          agentName: agent.name,
          compensationType: assignment.compensationType,
          commissionRate: assignment.commissionRate,
          startedAt: assignment.startedAt,
        });
      }
    }

    return {
      activeCount: assignments.length,
      isUnstaffed: assignments.length === 0,
      agents: agentDetails,
    };
  },
});
