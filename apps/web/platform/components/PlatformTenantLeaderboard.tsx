"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { EmptyState } from "@/shared/components/ui";
import { platformLeaderboard, type TenantLeaderboardMetric } from "@/shared/convex/platformLeaderboard";

const metricLabels: Record<TenantLeaderboardMetric, string> = {
  newSubscribers: "New subscribers",
  salesCount: "Sales",
  revenueUSD: "Revenue (USD)",
};
const formatScore = (value: number, metric: TenantLeaderboardMetric) => metric === "revenueUSD"
  ? `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  : value.toLocaleString("en-US");

export function PlatformTenantLeaderboard() {
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [metric, setMetric] = useState<TenantLeaderboardMetric>("newSubscribers");
  const result = useQuery(platformLeaderboard.getTenantLeaderboard, { days, metric });
  if (result === undefined) return <main className="workspace-page"><p className="pf-muted">Loading tenant leaderboard…</p></main>;

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform insights</p><h1 className="page-title">Tenant leaderboard</h1><p className="page-subtitle">Cross-tenant totals from market snapshots, ranked at tenant level.</p></div></header>
    <p className="pf-hint">Markets are combined inside each tenant; no market names, IDs, or market-level ranks are included. Missing daily snapshots are not treated as zero. The ranking uses recorded snapshots only and shows the top 100 tenants.</p>
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Ranking controls</p><h2>Choose window and measure</h2></div><span className="section-count">{result.totalTenants} tenants</span></div>
      <div className="form-grid"><label className="pf-field"><span className="pf-label">Snapshot window</span><select className="pf-input" value={days} onChange={event => setDays(Number(event.target.value) as 7 | 30 | 90)}><option value={7}>Last 7 days</option><option value={30}>Last 30 days</option><option value={90}>Last 90 days</option></select></label><label className="pf-field"><span className="pf-label">Rank by</span><select className="pf-input" value={metric} onChange={event => setMetric(event.target.value as TenantLeaderboardMetric)}>{Object.entries(metricLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label></div>
      <p className="pf-muted">Source: daily market snapshots · latest included snapshot: {result.latestSnapshotDate ?? "none"} · {result.snapshotRows.toLocaleString("en-US")} snapshot rows processed</p>
    </section>
    <section className="pf-panel" style={{ marginTop: 24 }}><div className="section-heading"><div><p className="eyebrow">Cross-tenant rollup</p><h2>Top {result.returnedTenants} by {metricLabels[metric].toLowerCase()}</h2></div><span className="section-count">{days} days</span></div>
      {result.ranking.length === 0 ? <EmptyState title="No tenant snapshots recorded" body="This ranking will appear after the selected period has daily market snapshots." /> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Rank</th><th>Tenant</th><th>{metricLabels[metric]}</th><th>Sales</th><th>New subscribers</th><th>Revenue (USD)</th><th>Snapshot days</th></tr></thead><tbody>{result.ranking.map(row => <tr key={row.tenantId}><td><strong>#{row.rank}</strong></td><td><strong>{row.tenantName}</strong></td><td>{formatScore(row.score, metric)}</td><td>{row.salesCount.toLocaleString("en-US")}</td><td>{row.newSubscribers.toLocaleString("en-US")}</td><td>{formatScore(row.revenueUSD, "revenueUSD")}</td><td>{row.snapshotDays}</td></tr>)}</tbody></table></div>}
    </section>
  </main>;
}
