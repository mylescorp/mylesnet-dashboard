"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Users, UserPlus, Percent, Layers } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import SimpleBars from "@/app/components/SimpleBars";
import { EmptyState, Loading, Select, StatusPill } from "@/app/components/ui";
import type { Id } from "@/convex/_generated/dataModel";

export default function SubscribersPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const [marketId, setMarketId] = useState("");
  const trend = useQuery(
    api.analytics.getSubscriberTrend,
    marketId ? { marketId: marketId as Id<"markets">, days: 30 } : { days: 30 },
  );

  if (markets === undefined || trend === undefined) return <Loading />;

  const latest = trend.length ? trend[trend.length - 1] : undefined;
  const active = latest?.activeCount ?? 0;
  const newThisPeriod = trend.reduce((s, r) => s + r.newCount, 0);
  const peak = trend.reduce((s, r) => Math.max(s, r.activeCount), 0);

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Business</p>
          <h1 className="page-title">Subscribers</h1>
          <p className="page-subtitle">Active subscriber base and growth from daily snapshots.</p>
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
        <MetricCard icon={Users} label="Active subscribers" value={active.toLocaleString()} tone="primary" detail={latest ? `As of ${latest.date}` : undefined} />
        <MetricCard icon={UserPlus} label="New sign-ups" value={newThisPeriod.toLocaleString()} tone="accent" detail="Last 30 days" />
        <MetricCard icon={Percent} label="Peak headcount" value={peak.toLocaleString()} tone="success" detail="Highest in the window" />
        <MetricCard icon={Layers} label="Markets" value={markets.length} tone="neutral" detail="Tracked markets" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Growth</p><h2>Active subscribers</h2></div>
        </div>
        <div className="pf-panel">
          {trend.length === 0 ? (
            <EmptyState title="No subscriber snapshots yet" body="Daily subscriber counts appear once the nightly rollup runs." />
          ) : (
            <SimpleBars data={trend.map((r) => ({ label: r.date.slice(5), value: r.activeCount }))} />
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Trend</p><h2>Daily headcount</h2></div>
        </div>
        <div className="pf-panel">
          {trend.length === 0 ? (
            <EmptyState title="No rows" body="Snapshot rows appear after the nightly rollup." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Date</th><th>Active</th><th className="pf-hide-sm">New</th><th>Delta</th></tr>
                </thead>
                <tbody>
                  {trend.map((r, i) => {
                    const prev = i > 0 ? trend[i - 1].activeCount : undefined;
                    const delta = prev === undefined ? null : r.activeCount - prev;
                    return (
                      <tr key={r.date}>
                        <td><strong>{r.date}</strong></td>
                        <td>{r.activeCount.toLocaleString()}</td>
                        <td className="pf-hide-sm">{r.newCount}</td>
                        <td>
                          {delta === null ? "—" : (
                            <StatusPill tone={delta >= 0 ? "success" : "danger"}>
                              {delta >= 0 ? "+" : ""}{delta}
                            </StatusPill>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
