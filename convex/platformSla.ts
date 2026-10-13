import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { assertSlaPriority, effectiveSlaTargets, PLATFORM_SLA_FALLBACK, validateSlaTargets } from "./lib/platformSlaCore";

const categories = ["network", "billing", "account"] as const;
const readers = ["platform_super_admin", "platform_support"];
const fallbackTargets = PLATFORM_SLA_FALLBACK;

async function enforceNetworkPriority(ctx: MutationCtx, category: typeof categories[number], candidate: { firstResponseMinutes: number; resolutionMinutes: number }) {
  const policies = await ctx.db.query("platformSlaPolicies").collect();
  const overrides = Object.fromEntries(policies.map(policy => [policy.category, policy])) as Partial<Record<typeof categories[number], { firstResponseMinutes: number; resolutionMinutes: number }>>;
  assertSlaPriority(category, candidate, effectiveSlaTargets(overrides));
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformSubRole(ctx, readers);
    const policies = await ctx.db.query("platformSlaPolicies").collect();
    const byCategory = new Map(policies.map(policy => [policy.category, policy]));
    const overrides = Object.fromEntries(policies.map(policy => [policy.category, policy])) as Partial<Record<typeof categories[number], { firstResponseMinutes: number; resolutionMinutes: number }>>;
    const effective = effectiveSlaTargets(overrides);
    return categories.map(category => {
      const policy = byCategory.get(category);
      return {
        _id: policy?._id ?? null,
        category,
        firstResponseMinutes: effective[category].firstResponseMinutes,
        resolutionMinutes: effective[category].resolutionMinutes,
        createdAt: policy?.createdAt ?? null,
        updatedAt: policy?.updatedAt ?? null,
        isOverride: policy !== undefined,
      };
    });
  },
});

export const create = mutation({
  args: { category: v.union(v.literal("network"), v.literal("billing"), v.literal("account")), firstResponseMinutes: v.number(), resolutionMinutes: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    validateSlaTargets(args);
    await enforceNetworkPriority(ctx, args.category, args);
    if (await ctx.db.query("platformSlaPolicies").withIndex("by_category", q => q.eq("category", args.category)).first()) throw new Error("SLA policy already exists for this category");
    const now = Date.now();
    const id = await ctx.db.insert("platformSlaPolicies", { ...args, createdBy: actor._id, createdAt: now, updatedBy: actor._id, updatedAt: now });
    await logAudit(ctx, { action: "support.sla.created", entityTable: "platformSlaPolicies", entityId: id, changedBy: actor._id, after: args });
    return id;
  },
});

export const update = mutation({
  args: { policyId: v.id("platformSlaPolicies"), firstResponseMinutes: v.number(), resolutionMinutes: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    validateSlaTargets(args);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("SLA policy not found");
    await enforceNetworkPriority(ctx, policy.category, args);
    const after = { firstResponseMinutes: args.firstResponseMinutes, resolutionMinutes: args.resolutionMinutes };
    await ctx.db.patch(policy._id, { ...after, updatedBy: actor._id, updatedAt: Date.now() });
    await logAudit(ctx, { action: "support.sla.updated", entityTable: "platformSlaPolicies", entityId: policy._id, changedBy: actor._id, before: { firstResponseMinutes: policy.firstResponseMinutes, resolutionMinutes: policy.resolutionMinutes }, after });
    return policy._id;
  },
});

export const remove = mutation({
  args: { policyId: v.id("platformSlaPolicies") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("SLA policy not found");
    const fallback = fallbackTargets[policy.category];
    await enforceNetworkPriority(ctx, policy.category, fallback);
    await ctx.db.delete(policy._id);
    await logAudit(ctx, { action: "support.sla.deleted", entityTable: "platformSlaPolicies", entityId: policy._id, changedBy: actor._id, before: { category: policy.category, firstResponseMinutes: policy.firstResponseMinutes, resolutionMinutes: policy.resolutionMinutes } });
    return { deleted: true };
  },
});
