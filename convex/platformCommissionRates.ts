import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { BUILT_IN_REFERRAL_DURATION_MONTHS, BUILT_IN_REFERRAL_RATE_BASIS_POINTS, validateCommissionRatePolicy } from "./lib/platformCommissionRateCore";

const managers = ["platform_super_admin", "platform_finance"];
const readers = [...managers, "platform_ops"];
export const getGlobal = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformSubRole(ctx, readers);
    const global = await ctx.db.query("platformCommissionRates").withIndex("by_scope", q => q.eq("scope", "global")).first();
    return global
      ? { id: global._id, scope: global.scope, relationshipId: null, agencyName: null, rateBasisPoints: global.rateBasisPoints, durationMonths: global.durationMonths, updatedAt: global.updatedAt }
      : { id: "baseline" as Id<"platformCommissionRates">, scope: "global" as const, relationshipId: null, agencyName: null, rateBasisPoints: BUILT_IN_REFERRAL_RATE_BASIS_POINTS, durationMonths: BUILT_IN_REFERRAL_DURATION_MONTHS, updatedAt: 0 };
  },
});

export const listOverrides = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    const page = await ctx.db.query("platformCommissionRates")
      .withIndex("by_scope_and_updatedAt", q => q.eq("scope", "agency"))
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)) });
    const rows = await Promise.all(page.page.map(async row => {
      const relation = row.relationshipId ? await ctx.db.get(row.relationshipId) : null;
      const tenant = relation && relation.type === "agency" ? await ctx.db.get(relation.childTenantId) : null;
      return { id: row._id, scope: row.scope, relationshipId: row.relationshipId ?? null, agencyName: tenant && !tenant.deletedAt ? tenant.name : null, rateBasisPoints: row.rateBasisPoints, durationMonths: row.durationMonths, updatedAt: row.updatedAt };
    }));
    return { ...page, page: rows };
  },
});

export const agencyOptions = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    const page = await ctx.db.query("tenantRelationships").withIndex("by_type", q => q.eq("type", "agency")).order("desc").paginate({ ...args.paginationOpts, numItems: Math.min(50, Math.max(1, args.paginationOpts.numItems)) });
    const rows = await Promise.all(page.page.filter(row => row.deletedAt === undefined).map(async row => {
      const tenant = await ctx.db.get(row.childTenantId);
      return tenant && !tenant.deletedAt ? { id: row._id, name: tenant.name, status: row.status } : null;
    }));
    return { ...page, page: rows.filter((row): row is NonNullable<typeof row> => row !== null).sort((a, b) => a.name.localeCompare(b.name)) };
  },
});

export const create = mutation({
  args: { scope: v.union(v.literal("global"), v.literal("agency")), relationshipId: v.optional(v.id("tenantRelationships")), rateBasisPoints: v.number(), durationMonths: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    validateCommissionRatePolicy(args.rateBasisPoints, args.durationMonths);
    if (args.scope === "global" && args.relationshipId) throw new Error("Global policy cannot target an agency");
    if (args.scope === "agency" && !args.relationshipId) throw new Error("Select an agency relationship");
    if (args.scope === "global" && await ctx.db.query("platformCommissionRates").withIndex("by_scope", q => q.eq("scope", "global")).first()) throw new Error("A global commission default already exists; edit it instead");
    if (args.relationshipId) {
      const relation = await ctx.db.get(args.relationshipId);
      if (!relation || relation.type !== "agency" || relation.deletedAt !== undefined) throw new Error("Active agency relationship not found");
      if (await ctx.db.query("platformCommissionRates").withIndex("by_relationship", q => q.eq("relationshipId", args.relationshipId)).first()) throw new Error("This agency already has an override");
    }
    const now = Date.now();
    const id = await ctx.db.insert("platformCommissionRates", { ...args, createdBy: actor._id, createdAt: now, updatedBy: actor._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.commissionRate.created", entityTable: "platformCommissionRates", entityId: id, changedBy: actor._id, after: { scope: args.scope, relationshipId: args.relationshipId ?? null, rateBasisPoints: args.rateBasisPoints, durationMonths: args.durationMonths } });
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("platformCommissionRates"), rateBasisPoints: v.number(), durationMonths: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    validateCommissionRatePolicy(args.rateBasisPoints, args.durationMonths);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Commission policy not found");
    await ctx.db.patch(row._id, { rateBasisPoints: args.rateBasisPoints, durationMonths: args.durationMonths, updatedBy: actor._id, updatedAt: Date.now() });
    await logAudit(ctx, { action: "platform.commissionRate.updated", entityTable: "platformCommissionRates", entityId: row._id, changedBy: actor._id, before: { rateBasisPoints: row.rateBasisPoints, durationMonths: row.durationMonths }, after: { rateBasisPoints: args.rateBasisPoints, durationMonths: args.durationMonths } });
    return { updated: true };
  },
});

export const saveGlobal = mutation({
  args: { rateBasisPoints: v.number(), durationMonths: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    validateCommissionRatePolicy(args.rateBasisPoints, args.durationMonths);
    const existing = await ctx.db.query("platformCommissionRates").withIndex("by_scope", q => q.eq("scope", "global")).first();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, { rateBasisPoints: args.rateBasisPoints, durationMonths: args.durationMonths, updatedBy: actor._id, updatedAt: now });
      await logAudit(ctx, { action: "platform.commissionRate.updated", entityTable: "platformCommissionRates", entityId: existing._id, changedBy: actor._id, before: { rateBasisPoints: existing.rateBasisPoints, durationMonths: existing.durationMonths }, after: { rateBasisPoints: args.rateBasisPoints, durationMonths: args.durationMonths } });
      return existing._id;
    }
    const id = await ctx.db.insert("platformCommissionRates", { scope: "global", rateBasisPoints: args.rateBasisPoints, durationMonths: args.durationMonths, createdBy: actor._id, createdAt: now, updatedBy: actor._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.commissionRate.created", entityTable: "platformCommissionRates", entityId: id, changedBy: actor._id, after: { scope: "global", rateBasisPoints: args.rateBasisPoints, durationMonths: args.durationMonths } });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("platformCommissionRates") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    const row = await ctx.db.get(args.id);
    if (!row) throw new Error("Commission policy not found");
    if (row.scope === "global") throw new Error("The global referral policy is required and cannot be deleted; edit the default instead");
    await ctx.db.delete(row._id);
    await logAudit(ctx, { action: "platform.commissionRate.deleted", entityTable: "platformCommissionRates", entityId: row._id, changedBy: actor._id, before: { scope: row.scope, relationshipId: row.relationshipId, rateBasisPoints: row.rateBasisPoints, durationMonths: row.durationMonths } });
    return { deleted: true };
  },
});
