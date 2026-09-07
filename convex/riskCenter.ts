import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { dayOf } from "./lib/finance";

/**
 * Risk center (spec "Risk Center"): brings the operational, technical and
 * financial risk signals into one ranked feed. Sources are already-persisted
 * tables — this only reads.
 */
export const getRiskOverview = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "risk_center:read");
    const now = Date.now();
    const items: {
      severity: "critical" | "warning" | "info";
      category: string;
      marketId?: string;
      message: string;
      metric: number;
    }[] = [];

    // 1. Open critical alerts.
    const openAlerts = await ctx.db.query("alerts").withIndex("by_status", (q) => q.eq("alertStatus", "open")).collect();
    const criticalAlerts = openAlerts.filter((a) => a.severity === "critical" || a.alertType === "device_offline");
    if (criticalAlerts.length > 0) {
      const byMarket = new Map<string, number>();
      for (const a of criticalAlerts) byMarket.set(a.marketId, (byMarket.get(a.marketId) ?? 0) + 1);
      for (const [marketId, count] of byMarket) {
        items.push({ severity: "critical", category: "offline_devices", marketId, message: `${count} critical alert(s) open for this market`, metric: count });
      }
    }

    // 2. Sustained high CPU on gateways (from the daily rollup).
    const tel = await ctx.db.query("telemetryDaily").filter((q) => q.eq(q.field("date"), dayOf(now))).collect();
    for (const row of tel.filter((r) => r.deviceKind === "router")) {
      if ((row.avgCpuPercent ?? 0) >= 90) {
        items.push({
          severity: "critical",
          category: "gateway_overloaded",
          marketId: row.marketId,
          message: `Gateway CPU sustained at ${Math.round(row.avgCpuPercent ?? 0)}%`,
          metric: row.avgCpuPercent ?? 0,
        });
      } else if ((row.avgCpuPercent ?? 0) >= 75) {
        items.push({
          severity: "warning",
          category: "gateway_overloaded",
          marketId: row.marketId,
          message: `Gateway CPU elevated at ${Math.round(row.avgCpuPercent ?? 0)}%`,
          metric: row.avgCpuPercent ?? 0,
        });
      }
    }

    // 3. Poor CCQ on access points (spec threshold 60).
    for (const row of tel.filter((r) => r.deviceKind === "access_point")) {
      if ((row.avgCcq ?? Infinity) === 0) continue;
      if ((row.avgCcq ?? Infinity) < 60) {
        items.push({
          severity: "warning",
          category: "low_ccq",
          marketId: row.marketId,
          message: `CCQ below 60% (${Math.round(row.avgCcq ?? 0)}%) on an access point`,
          metric: row.avgCcq ?? 0,
        });
      }
    }

    // 4. Day-over-day revenue drop > 20% (spec threshold).
    const todays = new Date();
    const y = todays.getFullYear();
    const m = todays.getMonth();
    const today = dayOf(now);
    const yesterday = dayOf(new Date(y, m, todays.getDate() - 1).getTime());
    const daily = await ctx.db.query("dailySnapshots").withIndex("by_date", (q) => q.gte("date", yesterday).lte("date", today)).collect();
    const byMarketToday = new Map<string, number>();
    const byMarketYesterday = new Map<string, number>();
    for (const d of daily) {
      const map = d.date === today ? byMarketToday : byMarketYesterday;
      map.set(d.marketId, (map.get(d.marketId) ?? 0) + d.revenueLocal);
    }
    for (const [marketId, revenueToday] of byMarketToday) {
      const revenueYesterday = byMarketYesterday.get(marketId) ?? 0;
      if (revenueYesterday > 0 && revenueToday < revenueYesterday * 0.8) {
        items.push({
          severity: "warning",
          category: "revenue_drop",
          marketId,
          message: `Day-over-day revenue down ${Math.round(((revenueYesterday - revenueToday) / revenueYesterday) * 100)}%`,
          metric: revenueToday,
        });
      }
    }

    // 5. Unreconciled payment events (payment risk).
    const recentPayments = (await ctx.db.query("paymentEvents").collect()).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);
    const failed = recentPayments.filter((p) => /fail|reject/i.test(p.eventType)).length;
    if (failed > 0) {
      items.push({ severity: "warning", category: "payment_failures", message: `${failed} failed payment event(s) in the last 50`, metric: failed });
    }

    // 6. Churn risk: subscriber snapshots trending down.
    const snapshots = await ctx.db.query("subscriberSnapshots").collect();
    const byMarketSeries = new Map<string, { date: string; activeCount: number }[]>();
    for (const s of snapshots) {
      const series = byMarketSeries.get(s.marketId) ?? [];
      series.push({ date: s.date, activeCount: s.activeCount });
      byMarketSeries.set(s.marketId, series);
    }
    for (const [marketId, series] of byMarketSeries) {
      const sorted = series.sort((a, b) => a.date.localeCompare(b.date));
      if (sorted.length >= 2) {
        const latest = sorted[sorted.length - 1];
        const prior = sorted[sorted.length - 2];
        if (prior.activeCount > 0 && latest.activeCount < prior.activeCount * 0.9) {
          items.push({
            severity: "info",
            category: "churn_risk",
            marketId,
            message: `Active subscribers down ${Math.round(((prior.activeCount - latest.activeCount) / prior.activeCount) * 100)}% vs previous snapshot`,
            metric: latest.activeCount,
          });
        }
      }
    }

    const rank: Record<string, number> = { critical: 0, warning: 1, info: 2 };
    const counts = { critical: items.filter((i) => i.severity === "critical").length, warning: items.filter((i) => i.severity === "warning").length, info: items.filter((i) => i.severity === "info").length };
    return { counts, items: items.sort((a, b) => rank[a.severity] - rank[b.severity]) };
  },
});
