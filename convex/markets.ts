import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { Doc } from "./_generated/dataModel";
import { requirePermission, requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { readTenantList, enforceTenantOnResource } from "./lib/tenant";
import { logAudit } from "./lib/auditLog";

export const listMarkets = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "markets:read");
    const rows = await readTenantList<Doc<"markets">>(ctx, {
      all: () => ctx.db.query("markets").collect(),
      tenant: (tenantId) =>
        ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    return rows.filter((m) => m.status !== "deleted");
  },
});

export const getMarket = query({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "markets:read");
    const market = await ctx.db.get(args.marketId);
    return await enforceTenantOnResource(ctx, market, "market");
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
 * Soft delete. Cascading agent assignments assigned to this
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

    const activeAssignments = await ctx.db
      .query("agentMarketAssignments")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .filter((q) => q.eq(q.field("assignmentStatus"), "active"))
      .collect();

    if (activeAssignments.length > 0 && !args.forceCascade) {
      throw new Error(
        `This market has ${activeAssignments.length} active agent assignment(s). ` +
          `Choose to end those assignments together (forceCascade: true) or reassign them first.`
      );
    }

    const now = Date.now();

    if (args.forceCascade) {
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

// ============================================================================
// PLATFORM-SPECIFIC MARKET FUNCTIONS (A2)
// Sub-role matrix: super_admin(CRUD) ops(CRU) finance(R) support(R) readonly(R)
// ============================================================================

/**
 * Platform-wide market list (cross-tenant) for /platform/organizations/[id]/markets
 * Sub-role matrix: super_admin(R), ops(R), finance(R), support(R), readonly(R)
 */
export const platformListMarkets = query({
  args: {
    tenantId: v.optional(v.id("tenants")),
    lifecycleStatus: v.optional(v.union(
      v.literal("planned"),
      v.literal("active"),
      v.literal("paused"),
      v.literal("decommissioned")
    )),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"]);
    
    let markets;
    
    if (args.tenantId) {
      let query = ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId));
      if (args.lifecycleStatus) {
        query = query.filter((q) => q.eq(q.field("lifecycleStatus"), args.lifecycleStatus));
      }
      markets = await query.take(Math.min(100, args.limit ?? 50));
    } else {
      let query = ctx.db.query("markets");
      if (args.lifecycleStatus) {
        query = query.filter((q) => q.eq(q.field("lifecycleStatus"), args.lifecycleStatus));
      }
      markets = await query.take(Math.min(100, args.limit ?? 50));
    }
    
    return markets.filter((m) => m.status !== "deleted");
  },
});

/**
 * Platform-wide market detail view
 * Sub-role matrix: super_admin(R), ops(R), finance(R), support(R), readonly(R)
 */
export const platformGetMarket = query({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"]);
    return await ctx.db.get(args.marketId);
  },
});

/**
 * Platform-wide market creation
 * Sub-role matrix: super_admin(C), ops(C)
 */
export const platformCreateMarket = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    country: v.string(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const now = Date.now();
    
    const marketId = await ctx.db.insert("markets", {
      tenantId: args.tenantId,
      name: args.name,
      country: args.country,
      currency: args.currency,
      lifecycleStatus: "planned",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    
    await logAudit(ctx, {
      action: "platform.market.create",
      entityTable: "markets",
      entityId: marketId,
      changedBy: user._id,
      after: { 
        tenantId: args.tenantId,
        name: args.name, 
        country: args.country 
      },
    });
    
    return marketId;
  },
});

/**
 * Platform-wide market update
 * Sub-role matrix: super_admin(CUD), ops(CU)
 */
export const platformUpdateMarket = mutation({
  args: {
    marketId: v.id("markets"),
    updates: v.object({
      name: v.optional(v.string()),
      country: v.optional(v.string()),
      currency: v.optional(v.string()),
      lifecycleStatus: v.optional(v.union(
        v.literal("planned"),
        v.literal("active"),
        v.literal("paused"),
        v.literal("decommissioned")
      )),
    }),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const market = await ctx.db.get(args.marketId);
    
    if (!market) {
      throw new Error("Market not found");
    }
    
    const before = JSON.stringify({ 
      name: market.name, 
      country: market.country,
      lifecycleStatus: market.lifecycleStatus 
    });
    
    await ctx.db.patch(args.marketId, {
      ...args.updates,
      updatedAt: Date.now(),
    });
    
    await logAudit(ctx, {
      action: "platform.market.update",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: user._id,
      before,
      after: args.updates,
    });
    
    return market._id;
  },
});

/**
 * Platform-wide market soft delete
 * Sub-role matrix: super_admin(CD), ops(CD - no hard delete)
 */
export const platformSoftDeleteMarket = mutation({
  args: {
    marketId: v.id("markets"),
    deleteReason: v.string(),
    forceCascade: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const market = await ctx.db.get(args.marketId);
    
    if (!market) {
      throw new Error("Market not found");
    }
    
    const activeAssignments = await ctx.db
      .query("agentMarketAssignments")
      .withIndex("by_market", (q) => q.eq("marketId", args.marketId))
      .filter((q) => q.eq(q.field("assignmentStatus"), "active"))
      .collect();
    
    if (activeAssignments.length > 0 && !args.forceCascade) {
      throw new Error(
        `This market has ${activeAssignments.length} active agent assignment(s). ` +
        `Choose to end those assignments together (forceCascade: true) or reassign them first.`
      );
    }
    
    const now = Date.now();
    
    if (args.forceCascade) {
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
      action: "platform.market.softDelete",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: user._id,
      before: { status: market.status },
      after: { status: "deleted", cascaded: !!args.forceCascade },
    });
  },
});

/**
 * Platform-wide market restore
 * Sub-role matrix: super_admin(CU), ops(CU)
 */
export const platformRestoreMarket = mutation({
  args: { marketId: v.id("markets") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const market = await ctx.db.get(args.marketId);
    
    if (!market) {
      throw new Error("Market not found");
    }
    
    await ctx.db.patch(args.marketId, {
      status: "active",
      restoredAt: Date.now(),
      restoredBy: user._id,
      updatedAt: Date.now(),
    });
    
    await logAudit(ctx, {
      action: "platform.market.restore",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: user._id,
    });
  },
});
