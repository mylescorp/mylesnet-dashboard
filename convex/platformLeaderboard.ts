import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { dayOf } from "./lib/finance";
import { aggregateTenantLeaderboard, type TenantLeaderboardMetric, type TenantSnapshotMetric } from "./lib/platformLeaderboardCore";

const metricValidator = v.union(v.literal("newSubscribers"), v.literal("salesCount"), v.literal("revenueUSD"));
const windowValidator = v.union(v.literal(7), v.literal(30), v.literal(90));
const MAX_SNAPSHOT_ROWS = 5000;
const PAGE_ROWS = 100;

/** Tenant-level rollup: all market measurements are summed before ranking; no market rows escape. */
export const getTenantLeaderboard = query({
  args: { days: windowValidator, metric: metricValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_readonly"]);
    const from = dayOf(Date.now() - (args.days - 1) * 24 * 60 * 60 * 1000);
    const snapshots = await ctx.db.query("dailySnapshots")
      .withIndex("by_date", q => q.gte("date", from))
      .order("asc")
      .take(MAX_SNAPSHOT_ROWS + 1);
    if (snapshots.length > MAX_SNAPSHOT_ROWS) {
      throw new Error("There are too many market snapshots for this window. Choose a shorter time period.");
    }
    const tenantIds = [...new Set(snapshots.map(row => row.tenantId).filter((id): id is NonNullable<typeof id> => id !== undefined))];
    const tenants = await Promise.all(tenantIds.map(id => ctx.db.get(id)));
    const names = new Map(tenants.filter((tenant): tenant is NonNullable<typeof tenant> => tenant !== null && tenant.deletedAt === undefined).map(tenant => [String(tenant._id), tenant.name]));
    const measures: TenantSnapshotMetric[] = snapshots.flatMap(row => {
      const tenantId = row.tenantId ? String(row.tenantId) : "";
      const tenantName = names.get(tenantId);
      return tenantName === undefined ? [] : [{ tenantId, tenantName, date: row.date, revenueUSD: row.revenueUSD, salesCount: row.salesCount, newSubscribers: row.newSubscribers }];
    });
    const all = aggregateTenantLeaderboard(measures, args.metric as TenantLeaderboardMetric);
    return {
      days: args.days,
      metric: args.metric,
      source: "dailySnapshots" as const,
      latestSnapshotDate: snapshots.at(-1)?.date ?? null,
      snapshotRows: snapshots.length,
      totalTenants: all.length,
      returnedTenants: Math.min(PAGE_ROWS, all.length),
      ranking: all.slice(0, PAGE_ROWS),
    };
  },
});
