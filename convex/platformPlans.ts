import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { DEFAULT_PLATFORM_PLANS } from "./lib/platformRevenueCore";

const readers = ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"];
const managers = ["platform_super_admin", "platform_finance"];
const codePattern = /^[a-z][a-z0-9_-]{1,39}$/;

async function ensureDefaultPlans(ctx: MutationCtx, userId: Id<"users">) {
  // Seed the baseline once for a new catalogue. Do not recreate an individual
  // plan after an administrator deliberately deletes it.
  if (await ctx.db.query("platformPlanCatalogMeta").first()) return;
  const now = Date.now();
  await ctx.db.insert("platformPlanCatalogMeta", { initializedBy: userId, initializedAt: now });
  if (await ctx.db.query("platformPlanCatalog").first()) return;
  for (const plan of DEFAULT_PLATFORM_PLANS) {
    const id = await ctx.db.insert("platformPlanCatalog", {
      ...plan,
      currency: "KES",
      status: "active",
      createdBy: userId,
      createdAt: now,
      updatedBy: userId,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "platform.plan.seeded",
      entityTable: "platformPlanCatalog",
      entityId: id,
      changedBy: userId,
      after: { code: plan.code, monthlyPriceMinor: plan.monthlyPriceMinor, currency: "KES" },
    });
  }
}

function validatePlan(code: string, name: string, monthlyPriceMinor: number) {
  const normalizedCode = code.trim().toLowerCase();
  const normalizedName = name.trim();
  if (!codePattern.test(normalizedCode)) throw new Error("Plan code must be 2–40 lowercase letters, digits, hyphens, or underscores");
  if (!normalizedName || normalizedName.length > 80) throw new Error("Plan name must be 1–80 characters");
  if (!Number.isSafeInteger(monthlyPriceMinor) || monthlyPriceMinor < 0 || monthlyPriceMinor > 100_000_000) {
    throw new Error("Monthly price must be a whole KES minor-unit amount between 0 and 1,000,000 KES");
  }
  return { code: normalizedCode, name: normalizedName, monthlyPriceMinor };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformSubRole(ctx, readers);
    const rows = await ctx.db.query("platformPlanCatalog").collect();
    if (rows.length > 0) return rows.sort((a, b) => a.code.localeCompare(b.code));
    if (await ctx.db.query("platformPlanCatalogMeta").first()) return [];
    return DEFAULT_PLATFORM_PLANS.map(plan => ({ ...plan, _id: `baseline:${plan.code}`, currency: "KES" as const, status: "active" as const, createdAt: 0, updatedAt: 0 }));
  },
});

/** Public landing-page prices; returns no tenant or internal plan metadata. */
export const listPublic = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("platformPlanCatalog").collect();
    const active = rows.filter(plan => plan.status === "active").sort((a, b) => a.code.localeCompare(b.code));
    if (rows.length > 0) return active.map(({ code, name, currency, monthlyPriceMinor }) => ({ code, name, currency, monthlyPriceMinor }));
    if (await ctx.db.query("platformPlanCatalogMeta").first()) return [];
    return DEFAULT_PLATFORM_PLANS.map(plan => ({ ...plan, currency: "KES" as const }));
  },
});

export const create = mutation({
  args: { code: v.string(), name: v.string(), monthlyPriceMinor: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    await ensureDefaultPlans(ctx, actor._id);
    const plan = validatePlan(args.code, args.name, args.monthlyPriceMinor);
    if (await ctx.db.query("platformPlanCatalog").withIndex("by_code", q => q.eq("code", plan.code)).first()) {
      throw new Error("A plan with this code already exists");
    }
    const now = Date.now();
    const id = await ctx.db.insert("platformPlanCatalog", { ...plan, currency: "KES", status: "active", createdBy: actor._id, createdAt: now, updatedBy: actor._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.plan.created", entityTable: "platformPlanCatalog", entityId: id, changedBy: actor._id, after: { ...plan, currency: "KES" } });
    return id;
  },
});

export const update = mutation({
  args: { code: v.string(), name: v.string(), monthlyPriceMinor: v.number() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    await ensureDefaultPlans(ctx, actor._id);
    const existing = await ctx.db.query("platformPlanCatalog").withIndex("by_code", q => q.eq("code", args.code)).first();
    if (!existing) throw new Error("Plan not found");
    const plan = validatePlan(existing.code, args.name, args.monthlyPriceMinor);
    await ctx.db.patch(existing._id, { name: plan.name, monthlyPriceMinor: plan.monthlyPriceMinor, updatedBy: actor._id, updatedAt: Date.now() });
    await logAudit(ctx, { action: "platform.plan.updated", entityTable: "platformPlanCatalog", entityId: existing._id, changedBy: actor._id, before: { name: existing.name, monthlyPriceMinor: existing.monthlyPriceMinor }, after: { name: plan.name, monthlyPriceMinor: plan.monthlyPriceMinor, currency: "KES" } });
    return existing._id;
  },
});

export const setStatus = mutation({
  args: { code: v.string(), status: v.union(v.literal("active"), v.literal("archived")) },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    await ensureDefaultPlans(ctx, actor._id);
    const existing = await ctx.db.query("platformPlanCatalog").withIndex("by_code", q => q.eq("code", args.code)).first();
    if (!existing) throw new Error("Plan not found");
    if (existing.status === args.status) return { changed: false, status: existing.status };
    await ctx.db.patch(existing._id, { status: args.status, updatedBy: actor._id, updatedAt: Date.now() });
    await logAudit(ctx, { action: "platform.plan.statusChanged", entityTable: "platformPlanCatalog", entityId: existing._id, changedBy: actor._id, before: { status: existing.status }, after: { status: args.status } });
    return { changed: true, status: args.status };
  },
});

export const remove = mutation({
  args: { code: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    await ensureDefaultPlans(ctx, actor._id);
    const existing = await ctx.db.query("platformPlanCatalog").withIndex("by_code", q => q.eq("code", args.code)).first();
    if (!existing) throw new Error("Plan not found");
    const entitlement = await ctx.db.query("entitlements").withIndex("by_planId", q => q.eq("planId", existing.code)).first();
    if (entitlement) throw new Error("This plan is referenced by tenant subscription records. Archive it to preserve the subscription and audit history.");
    await ctx.db.delete(existing._id);
    await logAudit(ctx, { action: "platform.plan.deleted", entityTable: "platformPlanCatalog", entityId: existing._id, changedBy: actor._id, before: { code: existing.code, name: existing.name, monthlyPriceMinor: existing.monthlyPriceMinor, status: existing.status } });
    return { deleted: true, code: existing.code };
  },
});
