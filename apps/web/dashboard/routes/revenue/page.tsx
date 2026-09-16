"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Wallet, TrendingUp, Zap, Receipt } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import SimpleBars from "@/app/components/SimpleBars";
import { EmptyState, Loading, Select, StatusPill } from "@/app/components/ui";
import type { Id } from "@/convex/_generated/dataModel";

const n = (v: number, d = 2) => v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function RevenuePage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const [marketId, setMarketId] = useState("");
  const trend = useQuery(
    api.analytics.getRevenueTrend,
    marketId ? { marketId: marketId as Id<"markets">, days: 30 } : { days: 30 },
  );

  if (markets === undefined || trend === undefined) return <Loading />;

  const totalNet = trend.series.reduce((s, r) => s + r.netContributionLocal, 0);
  const totalNew = trend.series.reduce((s, r) => s + r.newSubscribers, 0);
  const totalSales = trend.series.reduce((s, r) => s + r.salesCount, 0);
  const d2d = trend.dayOverDayPercent;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Business</p>
          <h1 className="page-title">Revenue</h1>
          <p className="page-subtitle">Daily revenue, net contribution and sign-up volumes over the last 30 days.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <Select value={marketId} onChange={(e) => setMarketId(e.target.value)} aria-label="Filter by market">
            <option value="">All markets</option>
            {markets.map((m) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Wallet} label="Revenue (USD)" value={n(trend.totalRevenueUSD)} tone="primary" detail="Last 30 days" />
        <MetricCard
          icon={TrendingUp}
          label="Day-over-day"
          value={d2d === null ? "—" : `${d2d >= 0 ? "+" : ""}${d2d.toFixed(1)}%`}
          tone={d2d === null || d2d < 0 ? "warning" : "success"}
          detail="Latest vs previous day"
        />
        <MetricCard icon={Zap} label="New subscribers" value={totalNew} tone="accent" detail={`${totalSales} sales recorded`} />
        <MetricCard icon={Receipt} label="Net contribution" value={n(totalNet)} tone={totalNet >= 0 ? "success" : "danger"} detail="Local, after variable costs" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Trend</p><h2>Revenue — local currency</h2></div>
        </div>
        <div className="pf-panel">
          {trend.series.length === 0 ? (
            <EmptyState title="No snapshot data yet" body="Daily revenue will appear once the nightly rollup runs." />
          ) : (
            <SimpleBars data={trend.series.map((r) => ({ label: r.date.slice(5), value: r.revenueLocal }))} formatTick={(v) => n(v, 0)} />
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Rollup</p><h2>Daily snapshots</h2></div>
        </div>
        <div className="pf-panel">
          {trend.series.length === 0 ? (
            <EmptyState title="No rows" body="Snapshot rows will appear after the nightly rollup." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Revenue local</th>
                    <th>Revenue USD</th>
                    <th className="pf-hide-sm">Net contribution</th>
                    <th className="pf-hide-sm">New subs</th>
                    <th className="pf-hide-sm">Sales</th>
                  </tr>
                </thead>
                <tbody>
                  {[...trend.series].reverse().map((r) => (
                    <tr key={r.date}>
                      <td><strong>{r.date}</strong></td>
                      <td>{n(r.revenueLocal)}</td>
                      <td>{n(r.revenueUSD)}</td>
                      <td className="pf-hide-sm"><StatusPill tone={r.netContributionLocal >= 0 ? "success" : "danger"}>{n(r.netContributionLocal)}</StatusPill></td>
                      <td className="pf-hide-sm">{r.newSubscribers}</td>
                      <td className="pf-hide-sm">{r.salesCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
