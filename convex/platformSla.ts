import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

const categories = ["network", "billing", "account"] as const;
const readers = ["platform_super_admin", "platform_support"];
const fallbackTargets = {
  network: { firstResponseMinutes: 15, resolutionMinutes: 240 },
  billing: { firstResponseMinutes: 60, resolutionMinutes: 2880 },
  account: { firstResponseMinutes: 120, resolutionMinutes: 4320 },
} as const;

function validateTargets(firstResponseMinutes: number, resolutionMinutes: number) {
  for (const [label, value] of [["First response", firstResponseMinutes], ["Resolution", resolutionMinutes]] as const) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 525_600) {
      throw new Error(`${label} target must be a whole number between 1 minute and 365 days`);
    }
  }
  if (resolutionMinutes < firstResponseMinutes) throw new Error("Resolution target must be at least as long as first response target");
}

async function enforceNetworkPriority(ctx: MutationCtx, category: typeof categories[number], firstResponseMinutes: number, resolutionMinutes: number) {
  const policies = await ctx.db.query("platformSlaPolicies").collect();
  const targets = Object.fromEntries(categories.map(value => {
    const configured = policies.find(policy => policy.category === value);
    return [value, configured ?? fallbackTargets[value]];
  })) as typeof fallbackTargets;
  if (category === "network") {
    for (const otherCategory of ["billing", "account"] as const) {
      if (firstResponseMinutes > targets[otherCategory].firstResponseMinutes || resolutionMinutes > targets[otherCategory].resolutionMinutes) {
        throw new Error("Network SLA targets must be at least as fast as billing and account targets");
      }
    }
  } else {
    const network = targets.network;
    if (network && (firstResponseMinutes < network.firstResponseMinutes || resolutionMinutes < network.resolutionMinutes)) {
      throw new Error("Network tickets must have the fastest response and resolution targets");
    }
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformSubRole(ctx, readers);
    return (await ctx.db.query("platformSlaPolicies").collect()).sort((a, b) => categories.indexOf(a.category) - categories.indexOf(b.category));
  },
});

export const create = mutation({
  args: { category: v.union(v.literal("network"), v.literal("billing"), v.literal("account")), firstResponseMinutes: v.number(), resolutionMinutes: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    validateTargets(args.firstResponseMinutes, args.resolutionMinutes);
    await enforceNetworkPriority(ctx, args.category, args.firstResponseMinutes, args.resolutionMinutes);
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
    validateTargets(args.firstResponseMinutes, args.resolutionMinutes);
    const policy = await ctx.db.get(args.policyId);
    if (!policy) throw new Error("SLA policy not found");
    await enforceNetworkPriority(ctx, policy.category, args.firstResponseMinutes, args.resolutionMinutes);
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
    await enforceNetworkPriority(ctx, policy.category, fallback.firstResponseMinutes, fallback.resolutionMinutes);
    await ctx.db.delete(policy._id);
    await logAudit(ctx, { action: "support.sla.deleted", entityTable: "platformSlaPolicies", entityId: policy._id, changedBy: actor._id, before: { category: policy.category, firstResponseMinutes: policy.firstResponseMinutes, resolutionMinutes: policy.resolutionMinutes } });
    return { deleted: true };
  },
});
