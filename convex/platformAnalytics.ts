import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { dayOf } from "./lib/finance";

const readers = ["platform_super_admin", "platform_finance", "platform_ops", "platform_readonly"];

/** Cross-tenant analytics over recorded per-market daily snapshots only. */
export const getDashboard = query({
  args: { days: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    const days = Math.max(1, Math.min(90, Math.floor(args.days ?? 30)));
    const from = dayOf(Date.now() - (days - 1) * 24 * 60 * 60 * 1000);
    const rows = await ctx.db.query("dailySnapshots")
      .withIndex("by_date", q => q.gte("date", from))
      .order("asc")
      .collect();

    const byDate = new Map<string, {
      revenueUSD: number;
      salesCount: number;
      newSubscribers: number;
      uptimeTotal: number;
      uptimeSamples: number;
      activeAlerts: number;
      alertSamples: number;
      marketIds: Set<string>;
    }>();
    for (const row of rows) {
      const day = byDate.get(row.date) ?? {
        revenueUSD: 0,
        salesCount: 0,
        newSubscribers: 0,
        uptimeTotal: 0,
        uptimeSamples: 0,
        activeAlerts: 0,
        alertSamples: 0,
        marketIds: new Set<string>(),
      };
      day.revenueUSD += row.revenueUSD;
      day.salesCount += row.salesCount;
      day.newSubscribers += row.newSubscribers;
      if (row.activeAlertsCount !== undefined) {
        day.activeAlerts += row.activeAlertsCount;
        day.alertSamples += 1;
      }
      if (row.avgUptimePercent !== undefined) {
        day.uptimeTotal += row.avgUptimePercent;
        day.uptimeSamples += 1;
      }
      day.marketIds.add(row.marketId);
      byDate.set(row.date, day);
    }

    const series = [...byDate.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, day]) => ({
      date,
      revenueUSD: Math.round(day.revenueUSD * 100) / 100,
      salesCount: day.salesCount,
      newSubscribers: day.newSubscribers,
      averageReportedUptime: day.uptimeSamples > 0 ? Math.round(day.uptimeTotal / day.uptimeSamples * 100) / 100 : null,
      uptimeMarketSamples: day.uptimeSamples,
      activeAlerts: day.alertSamples > 0 ? day.activeAlerts : null,
      alertMarketSamples: day.alertSamples,
      marketsReporting: day.marketIds.size,
    }));
    const latest = series.at(-1) ?? null;
    return {
      days,
      series,
      totals: {
        revenueUSD: Math.round(series.reduce((sum, day) => sum + day.revenueUSD, 0) * 100) / 100,
        salesCount: series.reduce((sum, day) => sum + day.salesCount, 0),
        newSubscribers: series.reduce((sum, day) => sum + day.newSubscribers, 0),
        marketsReporting: latest?.marketsReporting ?? 0,
        averageReportedUptime: latest?.averageReportedUptime ?? null,
        activeAlerts: latest?.activeAlerts ?? null,
        latestSnapshotDate: latest?.date ?? null,
      },
    };
  },
});
