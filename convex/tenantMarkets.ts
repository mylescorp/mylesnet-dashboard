import { v } from "convex/values";
import { MutationCtx, QueryCtx, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { marketSoftDeleteBlockReason } from "./lib/marketDependenciesCore";

const lifecycleStatus = v.union(
  v.literal("planned"),
  v.literal("active"),
  v.literal("paused"),
  v.literal("decommissioned"),
);

async function assertTenantAvailable(ctx: QueryCtx | MutationCtx, tenantId: Id<"tenants">) {
  const tenant = await ctx.db.get(tenantId);
  if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant not found");
  return tenant;
}

function assertMarketOwnedByTenant(market: Doc<"markets">, tenantId: Id<"tenants">) {
  if (market.tenantId !== tenantId) {
    throw new Error("Unauthorized: market does not belong to this tenant");
  }
}

/**
 * Platform-tier (A2) market inventory for a single tenant. The tenant comes
 * from the URL/args, not the caller's identity, so every write runs through
 * the platform sub-role matrix: super_admin(CRUD) and ops(CRUD); the
 * remaining sub-roles are read-only. Markets created here are tenant-scoped
 * by construction; pre-migration markets with no tenantId stay with the
 * tenant-side operator module.
 */
export const listForTenant = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    await assertTenantAvailable(ctx, args.tenantId);
    return ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).order("desc").collect();
  },
});

export const getForTenant = query({
  args: { tenantId: v.id("tenants"), marketId: v.id("markets") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    await assertTenantAvailable(ctx, args.tenantId);
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");
    assertMarketOwnedByTenant(market, args.tenantId);
    return market;
  },
});

export const createForTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    country: v.string(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    await assertTenantAvailable(ctx, args.tenantId);
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
      action: "market.create",
      entityTable: "markets",
      entityId: marketId,
      changedBy: actor._id,
      after: { name: args.name, country: args.country, tenantId: args.tenantId },
    });
    return marketId;
  },
});

export const updateForTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    marketId: v.id("markets"),
    name: v.optional(v.string()),
    country: v.optional(v.string()),
    currency: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    await assertTenantAvailable(ctx, args.tenantId);
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");
    assertMarketOwnedByTenant(market, args.tenantId);

    const fields = {
      name: args.name ?? market.name,
      country: args.country ?? market.country,
      currency: args.currency ?? market.currency,
    };
    await ctx.db.patch(args.marketId, { ...fields, updatedAt: Date.now() });
    await logAudit(ctx, {
      action: "market.update",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: actor._id,
      before: { name: market.name, country: market.country, currency: market.currency },
      after: fields,
    });
    return args.marketId;
  },
});

export const setLifecycleForTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    marketId: v.id("markets"),
    lifecycleStatus,
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    await assertTenantAvailable(ctx, args.tenantId);
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");
    assertMarketOwnedByTenant(market, args.tenantId);

    await ctx.db.patch(args.marketId, { lifecycleStatus: args.lifecycleStatus, updatedAt: Date.now() });
    await logAudit(ctx, {
      action: "market.statusChange",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: actor._id,
      before: { lifecycleStatus: market.lifecycleStatus },
      after: { lifecycleStatus: args.lifecycleStatus },
    });
    return args.marketId;
  },
});

export const softDeleteForTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    marketId: v.id("markets"),
    deleteReason: v.string(),
    forceCascade: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    await assertTenantAvailable(ctx, args.tenantId);
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");
    assertMarketOwnedByTenant(market, args.tenantId);

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

    const blockReason = marketSoftDeleteBlockReason(activeDevices.length, activeAssignments.length, !!args.forceCascade);
    if (blockReason) throw new Error(blockReason);

    const now = Date.now();
    if (args.forceCascade) {
      for (const device of activeDevices) {
        await ctx.db.patch(device._id, {
          status: "deleted",
          lifecycleStatus: "deleted",
          deletedAt: now,
          deletedBy: actor._id,
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
      deletedBy: actor._id,
      deleteReason: args.deleteReason,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "market.softDelete",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: actor._id,
      before: { status: market.status },
      after: { status: "deleted", cascaded: !!args.forceCascade },
    });
    return args.marketId;
  },
});

export const restoreForTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    marketId: v.id("markets"),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    await assertTenantAvailable(ctx, args.tenantId);
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");
    assertMarketOwnedByTenant(market, args.tenantId);

    await ctx.db.patch(args.marketId, {
      status: "active",
      restoredAt: Date.now(),
      restoredBy: actor._id,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "market.restore",
      entityTable: "markets",
      entityId: args.marketId,
      changedBy: actor._id,
    });
    return args.marketId;
  },
});