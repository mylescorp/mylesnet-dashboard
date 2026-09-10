"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Mail, Wallet, Users, ShieldAlert, TrendingUp, ShoppingBag, AlertTriangle } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill, formatDateTime } from "@/app/components/ui";

const n = (v: number, d = 2) => v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function DailyDigestPage() {
  const revenue = useQuery(api.analytics.getRevenueTrend, { days: 1 });
  const subs = useQuery(api.analytics.getSubscriberTrend, { days: 1 });
  const risk = useQuery(api.riskCenter.getRiskOverview, {});
  const exports = useQuery(api.scheduledReports.listReportExports, { limit: 5 });

  if (revenue === undefined || subs === undefined || risk === undefined || exports === undefined) return <Loading />;

  const lastRevenue = revenue.series.length ? revenue.series[revenue.series.length - 1] : undefined;
  const lastSubs = subs.length ? subs[subs.length - 1] : undefined;
  const critical = risk.counts.critical;

  const rows: { label: string; value: string; tone: "success" | "warning" | "danger" | "neutral" }[] = [
    { label: "Revenue today", value: lastRevenue ? `USD ${n(lastRevenue.revenueUSD)}` : "—", tone: "neutral" },
    { label: "Net contribution", value: lastRevenue ? n(lastRevenue.netContributionLocal) : "—", tone: lastRevenue && lastRevenue.netContributionLocal >= 0 ? "success" : "neutral" },
    { label: "New subscribers", value: String(lastSubs?.newCount ?? 0), tone: "neutral" },
    { label: "Sales", value: String(lastRevenue?.salesCount ?? 0), tone: "neutral" },
    { label: "Active subscribers", value: String(lastSubs?.activeCount ?? 0), tone: "success" },
    { label: "Critical risk findings", value: String(critical), tone: critical > 0 ? "danger" : "success" },
  ];

  const digestDate = lastRevenue?.date ?? lastSubs?.date ?? new Date().toISOString().slice(0, 10);

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reporting</p>
          <h1 className="page-title">Daily digest</h1>
          <p className="page-subtitle">The one-email summary every decision-maker gets — preview of {digestDate}.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Mail} label="Digest date" value={digestDate} tone="primary" detail="Scheduled nightly" />
        <MetricCard icon={Wallet} label="Revenue today" value={lastRevenue ? `$${n(lastRevenue.revenueUSD)}` : "—"} tone="success" detail="USD converted" />
        <MetricCard icon={Users} label="Subscribers" value={String(lastSubs?.activeCount ?? 0)} tone="accent" detail="Active base" />
        <MetricCard icon={ShieldAlert} label="Critical findings" value={critical} tone={critical > 0 ? "danger" : "success"} detail="Open risk items" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Preview</p><h2>Email contents</h2></div>
        </div>
        <div className="pf-panel">
          <div className="pf-table-wrap">
            <table className="pf-table">
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <td><strong>{row.label}</strong></td>
                    <td><StatusPill tone={row.tone}>{row.value}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Delivery</p><h2>Last rendered exports</h2></div>
        </div>
        <div className="pf-panel">
          {exports.length === 0 ? (
            <EmptyState title="No report exports yet" body="Generated reports and digests will appear here." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Dataset</th><th>Status</th><th className="pf-hide-sm">Format</th><th className="pf-hide-sm">Created</th></tr>
                </thead>
                <tbody>
                  {exports.map((e) => (
                    <tr key={e._id}>
                      <td><strong>{e.dataset ?? e.scheduledReportId ? "Scheduled" : "Manual"}</strong></td>
                      <td><StatusPill tone={e.status === "ready" ? "success" : e.status === "failed" ? "danger" : "warning"}>{e.status}</StatusPill></td>
                      <td className="pf-hide-sm">{e.format.toUpperCase()}</td>
                      <td className="pf-hide-sm">{formatDateTime(e.createdAt)}</td>
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
          <div><p className="eyebrow">Tip</p><h2>What is in the email</h2></div>
        </div>
        <div className="pf-panel">
          <ul className="pf-muted" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 6 }}>
            <li><TrendingUp size={13} style={{ verticalAlign: -2 }} /> Headline revenue and day-over-day movement.</li>
            <li><ShoppingBag size={13} style={{ verticalAlign: -2 }} /> Sales and new subscriber counts per market.</li>
            <li><AlertTriangle size={13} style={{ verticalAlign: -2 }} /> Open critical incidents and risk findings that need a human.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
