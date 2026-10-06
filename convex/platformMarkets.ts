import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { assertMarketBelongsToTenant, assertNoActiveMarketAssignments, normalizeMarketInput } from "./lib/platformMarketsCore";

const manager = ["platform_super_admin", "platform_ops"];
const reader = [...manager, "platform_finance", "platform_support", "platform_readonly"];

async function requireTenant(ctx: QueryCtx, tenantId: import("./_generated/dataModel").Id<"tenants">) {
  const tenant = await ctx.db.get(tenantId);
  if (!tenant || "deletedAt" in tenant && tenant.deletedAt !== undefined) throw new Error("Tenant not found");
  return tenant;
}

export const listForTenant = query({
  args: { tenantId: v.id("tenants"), includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, { tenantId, includeArchived }) => {
    await requirePlatformSubRole(ctx, reader);
    await requireTenant(ctx, tenantId);
    const rows = await ctx.db.query("markets").withIndex("by_tenant", q => q.eq("tenantId", tenantId)).collect();
    return rows.filter(row => includeArchived || row.status !== "deleted").sort((a,b) => a.name.localeCompare(b.name));
  },
});

export const createForTenant = mutation({
  args: { tenantId: v.id("tenants"), name: v.string(), country: v.string(), currency: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, manager);
    const tenant = await requireTenant(ctx, args.tenantId);
    const { name, country, currency } = normalizeMarketInput(args);
    const now = Date.now();
    const marketId = await ctx.db.insert("markets", { tenantId: args.tenantId, name, country, currency, lifecycleStatus: "planned", status: "active", createdAt: now, updatedAt: now });
    await logAudit(ctx, { action: "platform.market.create", entityTable: "markets", entityId: marketId, changedBy: user._id, after: { tenantId: args.tenantId, tenantName: tenant.name, name } });
    return marketId;
  },
});

export const setLifecycle = mutation({
  args: { tenantId: v.id("tenants"), marketId: v.id("markets"), lifecycleStatus: v.union(v.literal("planned"),v.literal("active"),v.literal("paused"),v.literal("decommissioned")) },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, manager);
    const market = await ctx.db.get(args.marketId);
    assertMarketBelongsToTenant(market, args.tenantId);
    if (market.status === "deleted") throw new Error("Restore this market before changing its lifecycle");
    await ctx.db.patch(args.marketId, { lifecycleStatus: args.lifecycleStatus, updatedAt: Date.now() });
    await logAudit(ctx, { action: "platform.market.lifecycle", entityTable: "markets", entityId: args.marketId, changedBy: user._id, before: { lifecycleStatus: market.lifecycleStatus }, after: { lifecycleStatus: args.lifecycleStatus } });
  },
});

export const updateForTenant = mutation({
  args: { tenantId: v.id("tenants"), marketId: v.id("markets"), name: v.string(), country: v.string(), currency: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, manager);
    const market = await ctx.db.get(args.marketId);
    assertMarketBelongsToTenant(market, args.tenantId);
    if (market.status === "deleted") throw new Error("Restore this market before editing it");
    const { name, country, currency } = normalizeMarketInput(args);
    await ctx.db.patch(args.marketId, { name, country, currency, updatedAt: Date.now() });
    await logAudit(ctx, { action: "platform.market.update", entityTable: "markets", entityId: args.marketId, changedBy: user._id, before: { name: market.name, country: market.country, currency: market.currency }, after: { name, country, currency } });
  },
});

export const softDeleteForTenant = mutation({
  args: { tenantId: v.id("tenants"), marketId: v.id("markets"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, manager);
    const market = await ctx.db.get(args.marketId);
    assertMarketBelongsToTenant(market, args.tenantId);
    if (market.status === "deleted") throw new Error("Market is already archived");
    const assignments = await ctx.db.query("agentMarketAssignments").withIndex("by_market", q => q.eq("marketId", args.marketId)).filter(q => q.eq(q.field("assignmentStatus"), "active")).collect();
    assertNoActiveMarketAssignments(assignments.length);
    const now = Date.now();
    await ctx.db.patch(args.marketId, { status: "deleted", deletedAt: now, deletedBy: user._id, deleteReason: args.reason.trim() || "Archived from platform organization markets", updatedAt: now });
    await logAudit(ctx, { action: "platform.market.archive", entityTable: "markets", entityId: args.marketId, changedBy: user._id, before: { status: market.status }, after: { status: "deleted" } });
  },
});


export const restoreForTenant = mutation({
  args: { tenantId: v.id("tenants"), marketId: v.id("markets") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, manager);
    const market = await ctx.db.get(args.marketId);
    assertMarketBelongsToTenant(market, args.tenantId);
    if (market.status !== "deleted") throw new Error("Market is not archived");
    const now = Date.now();
    await ctx.db.patch(args.marketId, { status: "active", deletedAt: undefined, deletedBy: undefined, deleteReason: undefined, restoredAt: now, restoredBy: user._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.market.restore", entityTable: "markets", entityId: args.marketId, changedBy: user._id, before: { status: market.status }, after: { status: "active" } });
  },
});
