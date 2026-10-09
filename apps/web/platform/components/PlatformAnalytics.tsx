"use client";

import { useQuery } from "@/app/lib/convex";
import { platformAnalytics } from "@/shared/convex/platformAnalytics";
import { EmptyState } from "@/shared/components/ui";

const money = (value: number) => `USD ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PlatformAnalytics() {
  const dashboard = useQuery(platformAnalytics.getDashboard, { days: 30 });
  if (dashboard === undefined) return <main className="workspace-page"><p className="pf-muted">Loading platform analytics…</p></main>;
  const series = dashboard.series;
  const width = 640;
  const height = 180;
  const minimum = Math.min(...series.map(row => row.revenueUSD), 0);
  const maximum = Math.max(...series.map(row => row.revenueUSD), 1);
  const points = series.map((row, index) => {
    const x = series.length === 1 ? width / 2 : index / (series.length - 1) * width;
    const y = height - ((row.revenueUSD - minimum) / Math.max(1, maximum - minimum)) * (height - 12) - 6;
    return `${x},${y}`;
  }).join(" ");

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform insights</p><h1 className="page-title">Platform analytics</h1><p className="page-subtitle">Cross-tenant rollup of recorded market snapshots for the last 30 days.</p></div></header>
    <p className="pf-hint">Revenue is converted to USD by each market’s daily snapshot. Uptime is an unweighted average of markets that reported a value. Missing uptime and alert fields are shown as unavailable rather than zero. This view contains aggregates only; it does not rank individual tenants or markets.</p>
    <section className="metric-grid" aria-label="Platform analytics summary">
      <Metric label="30-day revenue" value={money(dashboard.totals.revenueUSD)} detail="Recorded market snapshots, USD" />
      <Metric label="Sales" value={dashboard.totals.salesCount.toLocaleString("en-US")} detail="Recorded across the shown period" />
      <Metric label="New subscribers" value={dashboard.totals.newSubscribers.toLocaleString("en-US")} detail="Recorded across the shown period" />
      <Metric label="Latest reported uptime" value={dashboard.totals.averageReportedUptime === null ? "—" : `${dashboard.totals.averageReportedUptime}%`} detail={`${dashboard.totals.marketsReporting} markets reporting on ${dashboard.totals.latestSnapshotDate ?? "no date"}`} />
    </section>
    <section className="pf-panel" style={{ marginTop: 24 }}>
      <div className="section-heading"><div><p className="eyebrow">Recorded trend</p><h2>Daily revenue and operations</h2></div><span className="section-count">{series.length} days</span></div>
      {series.length === 0 ? <EmptyState title="No market snapshots recorded" body="The analytics view will populate after market daily snapshots are generated." /> : <>
        <div className="pf-revenue-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Daily platform revenue in USD across ${series.length} dates`} preserveAspectRatio="none"><polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg><div><span>{series[0]!.date}</span><span>{series[series.length - 1]!.date}</span></div></div>
        <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Date</th><th>Revenue (USD)</th><th>Sales</th><th>New subscribers</th><th>Reported uptime</th><th>Active alerts</th><th>Markets reporting</th></tr></thead><tbody>{series.map(row => <tr key={row.date}><td>{row.date}</td><td>{money(row.revenueUSD)}</td><td>{row.salesCount}</td><td>{row.newSubscribers}</td><td>{row.averageReportedUptime === null ? "—" : `${row.averageReportedUptime}% (${row.uptimeMarketSamples})`}</td><td>{row.activeAlerts === null ? "—" : `${row.activeAlerts} (${row.alertMarketSamples} markets)`}</td><td>{row.marketsReporting}</td></tr>)}</tbody></table></div>
      </>}
    </section>
  </main>;
}

function Metric({ label, value, detail }: { label: string; value: string; detail: string }) {
  return <article className="metric-card workspace-card"><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}
