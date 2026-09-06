import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Tariff plan catalogue (spec §26). Voucher batches may optionally link to a
 * plan row (voucherBatches.planId) so sales analytics join sold prices against
 * configured plans.
 */
export const listPlans = query({
  args: { marketId: v.optional(v.id("markets")), includeInactive: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const base = args.marketId
      ? await ctx.db.query("plans").withIndex("by_market", (q) => q.eq("marketId", args.marketId)).collect()
      : await ctx.db.query("plans").collect();
    const rows = args.includeInactive ? base : base.filter((p) => p.status === "active");
    return rows.sort((a, b) => a.priceLocal - b.priceLocal);
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
    const user = await requirePermission(ctx, "plans:manage");
    const existing = await ctx.db.query("plans").withIndex("by_code", (q) => q.eq("code", args.code)).first();
    if (existing && existing.status === "active") throw new Error("A plan with this code already exists");

    const id = await ctx.db.insert("plans", {
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
    const user = await requirePermission(ctx, "plans:manage");
    const plan = await ctx.db.get(args.planId);
    if (!plan) throw new Error("Plan not found");
    const { planId: _planId, ...patch } = args;
    await ctx.db.patch(args.planId, patch);
    await logAudit(ctx, {
      action: "plan.update",
      entityTable: "plans",
      entityId: args.planId,
      changedBy: user._id,
      after: patch,
    });
  },
});

export const linkBatchToPlan = mutation({
  args: { batchId: v.id("voucherBatches"), planId: v.id("plans") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "plans:manage");
    const batch = await ctx.db.get(args.batchId);
    if (!batch) throw new Error("Batch not found");
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