import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { calculatePlatformRevenue, DEFAULT_PLATFORM_PLANS } from "./lib/platformRevenueCore";

const readers = ["platform_super_admin", "platform_finance", "platform_readonly"];

async function currentRollup(ctx: QueryCtx) {
  const [tenants, entitlements, catalog] = await Promise.all([
    ctx.db.query("tenants").collect(),
    ctx.db.query("entitlements").collect(),
    ctx.db.query("platformPlanCatalog").collect(),
  ]);
  const prices = Object.fromEntries(catalog.length > 0
    ? catalog.map(plan => [plan.code, plan.monthlyPriceMinor] as const)
    : DEFAULT_PLATFORM_PLANS.map(plan => [plan.code, plan.monthlyPriceMinor] as const));
  const latestByTenant = new Map<string, (typeof entitlements)[number]>();
  for (const entitlement of entitlements) {
    const existing = latestByTenant.get(entitlement.tenantId);
    if (!existing || entitlement.updatedAt > existing.updatedAt || (entitlement.updatedAt === existing.updatedAt && entitlement._creationTime > existing._creationTime)) {
      latestByTenant.set(entitlement.tenantId, entitlement);
    }
  }
  const rows = tenants.filter(tenant => tenant.deletedAt === undefined).map(tenant => {
    const entitlement = latestByTenant.get(tenant._id);
    return { status: tenant.status, entitlement: entitlement ? { planId: entitlement.planId, status: entitlement.status } : null };
  });
  return calculatePlatformRevenue(rows, prices);
}

export const getDashboard = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    const days = Math.max(1, Math.min(90, Math.floor(args.days ?? 30)));
    const [current, snapshots] = await Promise.all([
      currentRollup(ctx),
      ctx.db.query("platformRevenueSnapshots").withIndex("by_snapshot_date").order("desc").take(days),
    ]);
    return { current, snapshots: snapshots.reverse() };
  },
});

export const captureDailySnapshot = internalMutation({
  args: { snapshotDate: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const now = Date.now();
    const snapshotDate = args.snapshotDate ?? new Date(now).toISOString().slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(snapshotDate)) throw new Error("Snapshot date must use YYYY-MM-DD");
    const rollup = await currentRollup(ctx);
    const existing = await ctx.db.query("platformRevenueSnapshots").withIndex("by_snapshot_date", q => q.eq("snapshotDate", snapshotDate)).first();
    const value = { snapshotDate, ...rollup, generatedAt: now };
    if (existing) await ctx.db.patch(existing._id, value);
    else await ctx.db.insert("platformRevenueSnapshots", value);
    return value;
  },
});
