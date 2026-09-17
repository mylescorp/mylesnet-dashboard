"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { BarChart3, TrendingUp, Users, DollarSign } from "lucide-react";
import MetricCard from "@/shared/components/MetricCard";
import SimpleBars from "@/shared/components/SimpleBars";
import { EmptyState, Loading, Select, StatusPill } from "@/shared/components/ui";

const n = (v: number, d = 2) => v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function AnalyticsPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const [marketId, setMarketId] = useState("");
  const revenue = useQuery(api.analytics.getRevenueTrend, marketId ? { marketId: marketId as Id<"markets">, days: 30 } : { days: 30 });
  const subscribers = useQuery(api.analytics.getSubscriberTrend, marketId ? { marketId: marketId as Id<"markets">, days: 30 } : { days: 30 });
  const topAgents = useQuery(api.analytics.getTopAgents, marketId ? { marketId: marketId as Id<"markets">, days: 30, limit: 10 } : { days: 30, limit: 10 });
  const salesMix = useQuery(api.analytics.getSalesMix, marketId ? { marketId: marketId as Id<"markets">, days: 30 } : { days: 30 });

  if (markets === undefined || revenue === undefined || subscribers === undefined || topAgents === undefined || salesMix === undefined) return <Loading />;

  const revenueLocalTotal = revenue.series.reduce((s, r) => s + r.revenueLocal, 0);
  const revenueNew = revenue.series.reduce((s, r) => s + r.newSubscribers, 0);
  const d2d = revenue.dayOverDayPercent;

  const activeCount = subscribers.length > 0 ? subscribers[subscribers.length - 1].activeCount : 0;
  const firstActive = subscribers.length > 0 ? subscribers[0].activeCount : 0;
  const growthPct = firstActive > 0 ? ((activeCount - firstActive) / firstActive) * 100 : null;
  const avgActive = subscribers.length > 0 ? subscribers.reduce((s, r) => s + r.activeCount, 0) / subscribers.length : 0;
  const arpu = avgActive > 0 ? revenueLocalTotal / avgActive : 0;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Insights</p>
          <h1 className="page-title">Analytics</h1>
          <p className="page-subtitle">Aggregated performance over the last 30 days from live snapshots and ledgers.</p>
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
        <MetricCard icon={DollarSign} label="Revenue (USD)" value={n(revenue.totalRevenueUSD)} tone="primary" detail="Last 30 days" />
        <MetricCard
          icon={TrendingUp}
          label="Day-over-day"
          value={d2d === null ? "—" : `${d2d >= 0 ? "+" : ""}${d2d.toFixed(1)}%`}
          tone={d2d === null || d2d < 0 ? "warning" : "success"}
          detail="Latest vs previous day"
        />
        <MetricCard icon={Users} label="Active subscribers" value={activeCount} tone="success" detail="Latest daily snapshot" />
        <MetricCard
          icon={BarChart3}
          label="Subscriber growth"
          value={growthPct === null ? "—" : `${growthPct >= 0 ? "+" : ""}${growthPct.toFixed(1)}%`}
          tone={growthPct === null || growthPct < 0 ? "warning" : "accent"}
          detail="Over the window"
        />
        <MetricCard icon={DollarSign} label="ARPU" value={arpu.toLocaleString("en", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} tone="neutral" detail="Revenue vs avg. active subs" />
        <MetricCard icon={Users} label="New subscribers" value={revenueNew} tone="accent" detail="Signed up in window" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Performance</p><h2>Revenue trend</h2></div>
        </div>
        <div className="pf-panel">
          {revenue.series.length === 0 ? (
            <EmptyState title="No snapshot data yet" body="Daily revenue will appear once the nightly rollup runs." />
          ) : (
            <SimpleBars data={revenue.series.map((r) => ({ label: r.date.slice(5), value: r.revenueLocal }))} formatTick={(v) => n(v, 0)} />
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Growth</p><h2>Subscriber growth</h2></div>
        </div>
        <div className="pf-panel">
          {subscribers.length === 0 ? (
            <EmptyState title="No subscriber snapshots yet" body="Active counts will appear once the nightly rollup runs." />
          ) : (
            <SimpleBars data={subscribers.map((r) => ({ label: r.date.slice(5), value: r.activeCount }))} formatTick={(v) => n(v, 0)} />
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Performance</p><h2>Top agents</h2></div>
        </div>
        <div className="pf-panel">
          {topAgents.length === 0 ? (
            <EmptyState title="No agent activity" body="Sales activity will appear once agents make sales." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Agent</th>
                    <th className="pf-hide-sm">Events</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {topAgents.map((a, i) => (
                    <tr key={a.agentId}>
                      <td><StatusPill tone={i === 0 ? "success" : "neutral"}>{i + 1}</StatusPill></td>
                      <td><strong>{a.agentName}</strong></td>
                      <td className="pf-hide-sm">{a.count}</td>
                      <td>{a.currency} {n(a.revenueLocal)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Product</p><h2>Sales mix</h2></div>
        </div>
        <div className="pf-panel">
          {salesMix.length === 0 ? (
            <EmptyState title="No sales yet" body="Sales mix will appear once activity is recorded." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Plan / event</th>
                    <th>Units</th>
                    <th>Revenue</th>
                  </tr>
                </thead>
                <tbody>
                  {salesMix.map((m) => (
                    <tr key={m.plan}>
                      <td><strong>{m.plan}</strong></td>
                      <td>{m.count}</td>
                      <td>{n(m.revenueLocal)}</td>
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