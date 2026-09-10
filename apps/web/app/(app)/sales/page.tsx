"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Trophy, Layers, ShoppingBag, CircleDollarSign } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill } from "@/app/components/ui";

const n = (v: number, d = 2) => v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function SalesPage() {
  const mix = useQuery(api.analytics.getSalesMix, { days: 30 });
  const topAgents = useQuery(api.analytics.getTopAgents, { days: 30, limit: 8 });

  if (mix === undefined || topAgents === undefined) return <Loading />;

  const totalRevenue = mix.reduce((s, r) => s + r.revenueLocal, 0);
  const totalSales = mix.reduce((s, r) => s + r.count, 0);
  const topAgent = topAgents.length ? topAgents[0] : undefined;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Business</p>
          <h1 className="page-title">Sales</h1>
          <p className="page-subtitle">What is selling, who is selling it, and how much it brings in — last 30 days.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={ShoppingBag} label="Sales" value={totalSales} tone="primary" detail="Events, 30 days" />
        <MetricCard icon={CircleDollarSign} label="Sales revenue" value={n(totalRevenue)} tone="accent" detail="Local currency" />
        <MetricCard icon={Trophy} label="Top agent" value={topAgent ? topAgent.agentName : "—"} tone="success" detail={topAgent ? `${n(topAgent.revenueLocal)} / ${topAgent.count} sales` : undefined} />
        <MetricCard icon={Layers} label="Product lines" value={mix.length} tone="warning" detail="Active mix entries" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Mix</p><h2>Sales by product</h2></div>
        </div>
        <div className="pf-panel">
          {mix.length === 0 ? (
            <EmptyState title="No sales activity" body="Airtime sales recorded by agents will appear here." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Product / action</th><th>Sales</th><th>Revenue local</th><th className="pf-hide-sm">Share</th></tr>
                </thead>
                <tbody>
                  {mix.map((r) => (
                    <tr key={r.plan}>
                      <td><strong>{r.plan}</strong></td>
                      <td>{r.count}</td>
                      <td>{n(r.revenueLocal)}</td>
                      <td className="pf-hide-sm">{totalRevenue > 0 ? `${((r.revenueLocal / totalRevenue) * 100).toFixed(1)}%` : "—"}</td>
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
          <div><p className="eyebrow">Agents</p><h2>Top sellers</h2></div>
        </div>
        <div className="pf-panel">
          {topAgents.length === 0 ? (
            <EmptyState title="No agent activity" body="Agent sales will appear here as they transact." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Agent</th><th>Sales</th><th>Revenue local</th><th className="pf-hide-sm">Currency</th></tr>
                </thead>
                <tbody>
                  {topAgents.map((a, i) => (
                    <tr key={a.agentId}>
                      <td><strong>{i + 1}. {a.agentName}</strong></td>
                      <td>{a.count}</td>
                      <td>{n(a.revenueLocal)}</td>
                      <td className="pf-hide-sm"><StatusPill tone="neutral">{a.currency}</StatusPill></td>
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
