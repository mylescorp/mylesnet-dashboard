"use client";

import { useQuery } from "@/app/lib/convex";
import Link from "next/link";
import { platformRevenue } from "@/shared/convex/platformRevenue";
import { EmptyState, StatusPill } from "@/shared/components/ui";

const money = (minor: number) => `KES ${(minor / 100).toLocaleString("en-KE", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function PlatformRevenue() {
  const dashboard = useQuery(platformRevenue.getDashboard, { days: 30 });
  if (dashboard === undefined) return <main className="workspace-page"><p className="pf-muted">Loading contracted revenue…</p></main>;
  const { current, snapshots } = dashboard;
  const trend = snapshots.length > 1 ? snapshots[snapshots.length - 1]!.mrrMinor - snapshots[0]!.mrrMinor : null;
  const minimum = Math.min(...snapshots.map(row => row.mrrMinor), 0);
  const maximum = Math.max(...snapshots.map(row => row.mrrMinor), 1);
  const width = 640;
  const height = 180;
  const points = snapshots.map((row, index) => {
    const x = snapshots.length === 1 ? width / 2 : index / (snapshots.length - 1) * width;
    const y = height - ((row.mrrMinor - minimum) / Math.max(1, maximum - minimum)) * (height - 12) - 6;
    return `${x},${y}`;
  }).join(" ");

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform billing</p><h1 className="page-title">Revenue</h1><p className="page-subtitle">Contracted recurring revenue based on active tenant plan entitlements.</p></div><div style={{ display: "flex", alignItems: "center", gap: 10 }}><StatusPill tone="neutral">KES base currency</StatusPill><Link className="secondary-button" href="/platform/billing/plans">Manage plans</Link></div></header>
    <p className="pf-hint">MRR uses the configured global monthly KES plan prices. ARR is MRR × 12. Trials, suspended tenants, and unknown plan IDs are not counted. These figures describe contracted value, not invoices issued or cash collected.</p>
    <section className="metric-grid" aria-label="Platform recurring revenue summary">
      <Metric label="Contracted MRR" value={money(current.mrrMinor)} detail="Active, priced tenant entitlements" />
      <Metric label="Annual run rate" value={money(current.arrMinor)} detail="Contracted MRR × 12" />
      <Metric label="Active tenants" value={current.activeTenants.toLocaleString("en-KE")} detail="Active tenants with active entitlements" />
      <Metric label="Unpriced plans" value={current.unpricedActiveTenants.toLocaleString("en-KE")} detail="Active plan IDs excluded from MRR" tone={current.unpricedActiveTenants ? "warning" : "success"} />
    </section>
    {current.unpricedActiveTenants ? <p className="platform-claim-message" role="status">{current.unpricedActiveTenants} active tenant entitlement(s) use a plan ID with no approved monthly price. Add a reviewed plan price before including them in MRR.</p> : null}
    <section className="pf-panel" style={{ marginTop: 24 }}>
      <div className="section-heading"><div><p className="eyebrow">Daily snapshots</p><h2>30-day MRR trend</h2></div><span className="section-count">{snapshots.length} days</span></div>
      {snapshots.length === 0 ? <EmptyState title="Trend history is starting" body="Daily aggregate snapshots begin after the scheduled platform revenue job runs." /> : <>
        <div className="pf-revenue-chart"><svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Contracted MRR over ${snapshots.length} daily snapshots`} preserveAspectRatio="none"><polyline points={points} fill="none" stroke="var(--primary)" strokeWidth="3" vectorEffect="non-scaling-stroke" /></svg><div><span>{snapshots[0]!.snapshotDate}</span><span>{snapshots[snapshots.length - 1]!.snapshotDate}</span></div></div>
        {trend !== null ? <p className="pf-muted">Change across shown snapshots: {trend > 0 ? "+" : ""}{money(trend)}.</p> : null}
        <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Date</th><th>Contracted MRR</th><th>Annual run rate</th><th>Priced tenants</th><th>Unpriced plans</th></tr></thead><tbody>{snapshots.map(row=><tr key={row._id}><td>{row.snapshotDate}</td><td>{money(row.mrrMinor)}</td><td>{money(row.arrMinor)}</td><td>{row.activeTenants-row.unpricedActiveTenants}</td><td>{row.unpricedActiveTenants}</td></tr>)}</tbody></table></div>
      </>}
    </section>
  </main>;
}

function Metric({ label, value, detail, tone = "accent" }: { label: string; value: string; detail: string; tone?: "accent" | "success" | "warning" }) {
  return <article className={`metric-card workspace-card metric-card-${tone}`}><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}
