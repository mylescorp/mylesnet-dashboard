import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTenantPermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Tariff plan catalogue (spec §26). Voucher batches may optionally link to a
 * plan row (voucherBatches.planId) so sales analytics join sold prices against
 * configured plans.
 */
export const listPlans = query({
  args: { marketId: v.optional(v.id("markets")), includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "plans:read");
    if (args.marketId) {
      const market = await ctx.db.get(args.marketId);
      if (!market || market.tenantId !== tenantId) throw new Error("Market not found");
    }
    const base = args.marketId
      ? await ctx.db.query("plans").withIndex("by_market", (q) => q.eq("marketId", args.marketId)).collect()
      : await ctx.db.query("plans").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    const rows = base.filter((plan) => plan.tenantId === tenantId && (args.includeInactive || plan.status === "active"));
    return rows.sort((a, b) => a.priceLocal - b.priceLocal);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    const { tenantId } = await requireTenantPermission(ctx, "plans:read");
    const plans = await ctx.db.query("plans").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    return plans.filter((p) => p.status === "active").sort((a, b) => a.priceLocal - b.priceLocal);
  },
});

export const createPlan = mutation({
  args: {
    marketId: v.optional(v.id("markets")),
    code: v.string(),
    name: v.string(),
    category: v.union(v.literal("data"), v.literal("tv"), v.literal("home_bundle")),
    priceLocal: v.number(),
    currency: v.string(),
    durationLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "plans:manage");
    if (args.marketId) {
      const market = await ctx.db.get(args.marketId);
      if (!market || market.tenantId !== tenantId) throw new Error("Market not found");
    }
    const existing = await ctx.db.query("plans").withIndex("by_code", (q) => q.eq("code", args.code)).first();
    if (existing && existing.tenantId === tenantId && existing.status === "active") throw new Error("A plan with this code already exists");

    const id = await ctx.db.insert("plans", {
      tenantId,
      marketId: args.marketId,
      code: args.code,
      name: args.name,
      category: args.category,
      priceLocal: args.priceLocal,
      currency: args.currency,
      durationLabel: args.durationLabel,
      status: "active",
      createdBy: user._id,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "plan.create",
      entityTable: "plans",
      entityId: id,
      changedBy: user._id,
      after: args,
    });
    return id;
  },
});

export const updatePlan = mutation({
  args: {
    planId: v.id("plans"),
    name: v.optional(v.string()),
    priceLocal: v.optional(v.number()),
    currency: v.optional(v.string()),
    durationLabel: v.optional(v.string()),
    status: v.optional(v.union(v.literal("active"), v.literal("inactive"))),
  },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "plans:manage");
    const plan = await ctx.db.get(args.planId);
    if (!plan || plan.tenantId !== tenantId) throw new Error("Plan not found");
    const patch = { name: args.name, priceLocal: args.priceLocal, currency: args.currency, durationLabel: args.durationLabel, status: args.status };
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    await ctx.db.patch(args.planId, cleaned);
    await logAudit(ctx, {
      action: "plan.update",
      entityTable: "plans",
      entityId: args.planId,
      changedBy: user._id,
      after: cleaned,
    });
  },
});

export const linkBatchToPlan = mutation({
  args: { batchId: v.id("voucherBatches"), planId: v.id("plans") },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "plans:manage");
    const batch = await ctx.db.get(args.batchId);
    const plan = await ctx.db.get(args.planId);
    if (!batch || batch.tenantId !== tenantId || !plan || plan.tenantId !== tenantId) throw new Error("Batch or plan not found");
    await ctx.db.patch(args.batchId, { planId: args.planId });
    await logAudit(ctx, {
      action: "batch.linkPlan",
      entityTable: "voucherBatches",
      entityId: args.batchId,
      changedBy: user._id,
      after: { planId: args.planId },
    });
  },
});
