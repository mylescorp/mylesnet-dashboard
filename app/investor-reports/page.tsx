"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Banknote, TrendingUp, Users, FileBarChart } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import SimpleBars from "@/app/components/SimpleBars";
import { EmptyState, Loading, Select, StatusPill, formatDateTime } from "@/app/components/ui";

const n = (v: number, d = 2) => v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function InvestorReportsPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const overview = useQuery(api.investors.getInvestorOverview, {});
  const investors = useQuery(api.investors.listInvestors, {});
  const reports = useQuery(api.investors.listInvestorReports, {});

  if (markets === undefined || overview === undefined || investors === undefined || reports === undefined) return <Loading />;

  const byMonth = new Map<string, number>();
  for (const r of reports) byMonth.set(r.period, (byMonth.get(r.period) ?? 0) + 1);
  const trend = [...byMonth.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));

  const snapshotOf = (period: string) => {
    const rep = [...reports].find((r) => r.period === period);
    if (!rep || !rep.snapshot) return null;
    const snap = rep.snapshot as { totalMonthlyRevenueUSD?: number; totalNetContributionLocal?: number; revenueUSD?: number; netContributionLocal?: number };
    return snap;
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="page-title">Investor reports</h1>
          <p className="page-subtitle">Fundraising picture and the monthly reporting trail for investors.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Banknote} label="Total raised" value={`$${n(overview.totalInvestmentUSD)}`} tone="primary" detail={`${overview.activeInvestorCount} active investors`} />
        <MetricCard icon={TrendingUp} label="Monthly revenue" value={`$${n(overview.totalMonthlyRevenueUSD)}`} tone="success" detail={overview.month} />
        <MetricCard icon={Users} label="Investors" value={investors.length} tone="accent" detail="All on book" />
        <MetricCard icon={FileBarChart} label="Reports generated" value={reports.length} tone="warning" detail="All periods" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">This month</p><h2>Monthly overview — {overview.month}</h2></div>
        </div>
        <div className="pf-panel">
          {overview.perMarket.length === 0 ? (
            <EmptyState title="No market financials this month" body="Financials for this month will appear once recorded." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Market</th><th>Revenue USD</th><th className="pf-hide-sm">Net contribution</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {overview.perMarket.map((m) => (
                    <tr key={m.marketId}>
                      <td><strong>{m.marketName}</strong></td>
                      <td>${n(m.revenueUSD)}</td>
                      <td className="pf-hide-sm">{n(m.netContributionLocal)}</td>
                      <td><StatusPill tone={m.status === "profit" ? "success" : m.status === "loss" ? "danger" : "neutral"}>{m.status.replace("_", " ")}</StatusPill></td>
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
          <div><p className="eyebrow">Capital</p><h2>Investors</h2></div>
        </div>
        <div className="pf-panel">
          {investors.length === 0 ? (
            <EmptyState title="No investors on book" body="Investors appear once added." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Investor</th><th className="pf-hide-sm">Instrument</th><th>Investment</th><th className="pf-hide-sm">Equity</th><th className="pf-hide-sm">Report cadence</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {investors.map((inv) => (
                    <tr key={inv._id}>
                      <td><strong>{inv.name}</strong><span className="pf-muted"> · {inv.email}</span></td>
                      <td className="pf-hide-sm">{inv.instrumentType.replace("_", " ")}</td>
                      <td>${n(inv.investmentAmountUSD)}</td>
                      <td className="pf-hide-sm">{inv.equityPercent ? `${inv.equityPercent}%` : "—"}</td>
                      <td className="pf-hide-sm">{inv.reportFrequency}</td>
                      <td><StatusPill tone={inv.status === "active" ? "success" : "neutral"}>{inv.status}</StatusPill></td>
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
          <div><p className="eyebrow">Trail</p><h2>Generated reports</h2></div>
        </div>
        <div className="pf-panel">
          {reports.length === 0 ? (
            <EmptyState title="No generated reports yet" body="Generated investor reports will appear here." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Period</th><th>Investor</th><th className="pf-hide-sm">Monthly revenue</th><th className="pf-hide-sm">Net contribution</th><th>Generated</th></tr>
                </thead>
                <tbody>
                  {reports.slice(0, 50).map((r) => {
                    const snap = snapshotOf(r.period);
                    const investor = investors.find((i) => i._id === r.investorId);
                    return (
                      <tr key={r._id}>
                        <td><strong>{r.period}</strong></td>
                        <td>{investor?.name ?? "All investors"}</td>
                        <td className="pf-hide-sm">{snap?.totalMonthlyRevenueUSD !== undefined ? `$${n(snap.totalMonthlyRevenueUSD)}` : snap?.revenueUSD !== undefined ? `$${n(snap.revenueUSD)}` : "—"}</td>
                        <td className="pf-hide-sm">{snap?.totalNetContributionLocal !== undefined ? n(snap.totalNetContributionLocal) : snap?.netContributionLocal !== undefined ? n(snap.netContributionLocal) : "—"}</td>
                        <td className="pf-hide-sm">{formatDateTime(r.generatedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {trend.length === 0 ? null : (
        <div className="section-block">
          <div className="section-heading">
            <div><p className="eyebrow">Cadence</p><h2>Reports per period</h2></div>
          </div>
          <div className="pf-panel">
            <SimpleBars data={trend} />
          </div>
        </div>
      )}
    </div>
  );
}
