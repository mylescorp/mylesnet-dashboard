"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Banknote, TrendingUp, Users, FileBarChart } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import SimpleBars from "@/app/components/SimpleBars";
import { EmptyState, ErrorNote, Loading, Select, StatusPill, TextInput, formatDateTime } from "@/app/components/ui";
import { useUserProfile } from "@/app/components/UserProfileContext";

const n = (v: number, d = 2) => v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function InvestorReportsPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const overview = useQuery(api.investors.getInvestorOverview, {});
  const investors = useQuery(api.investors.listInvestors, {});
  const reports = useQuery(api.investors.listInvestorReports, {});
  const createInvestor = useMutation(api.investors.createInvestor);
  const updateInvestor = useMutation(api.investors.updateInvestor);
  const generateReport = useMutation(api.investors.generateInvestorReportForAdmin);
  const { user } = useUserProfile();
  const canManage = user?.permissions?.includes("investors:manage") === true;
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<Id<"investors"> | null>(null);
  const [form, setForm] = useState({ name: "", email: "", amount: "", date: new Date().toISOString().slice(0, 10), instrumentType: "equity" as "equity" | "safe" | "loan" | "revenue_share", reportFrequency: "monthly" as "weekly" | "monthly", notes: "" });
  const [error, setError] = useState<string | null>(null);

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

  const resetForm = () => {
    setFormOpen(false);
    setEditingId(null);
    setForm({ name: "", email: "", amount: "", date: new Date().toISOString().slice(0, 10), instrumentType: "equity", reportFrequency: "monthly", notes: "" });
    setError(null);
  };

  const saveInvestor = async () => {
    setError(null);
    try {
      if (!form.name.trim() || !form.email.trim() || Number(form.amount) < 0) throw new Error("Name, email and a non-negative investment amount are required");
      if (editingId) await updateInvestor({ investorId: editingId, name: form.name.trim(), email: form.email.trim(), instrumentType: form.instrumentType, reportFrequency: form.reportFrequency, notes: form.notes || undefined });
      else await createInvestor({ name: form.name.trim(), email: form.email.trim(), investmentAmountUSD: Number(form.amount), investmentDate: form.date, instrumentType: form.instrumentType, reportFrequency: form.reportFrequency, notes: form.notes || undefined });
      resetForm();
    } catch (err) { setError(err instanceof Error ? err.message : "Could not save investor"); }
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
          {canManage && <button className="pf-button pf-button-primary" onClick={() => { resetForm(); setFormOpen(true); }}><span aria-hidden="true">+</span> Add investor</button>}
        </div>
        {canManage && (formOpen || editingId) && (
          <div className="pf-panel" style={{ marginBottom: 16 }}>
            <div className="section-heading"><div><p className="eyebrow">{editingId ? "Update" : "Create"}</p><h2>{editingId ? "Edit investor" : "New investor"}</h2></div></div>
            {error && <ErrorNote>{error}</ErrorNote>}
            <div className="pf-form-grid">
              <label className="pf-field"><span className="pf-label">Name *</span><TextInput value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Email *</span><TextInput type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Investment USD *</span><TextInput type="number" min="0" disabled={Boolean(editingId)} value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Investment date</span><TextInput type="date" disabled={Boolean(editingId)} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
              <label className="pf-field"><span className="pf-label">Instrument</span><Select value={form.instrumentType} onChange={(event) => setForm({ ...form, instrumentType: event.target.value as typeof form.instrumentType })}><option value="equity">Equity</option><option value="safe">SAFE</option><option value="loan">Loan</option><option value="revenue_share">Revenue share</option></Select></label>
              <label className="pf-field"><span className="pf-label">Report cadence</span><Select value={form.reportFrequency} onChange={(event) => setForm({ ...form, reportFrequency: event.target.value as typeof form.reportFrequency })}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></Select></label>
              <label className="pf-field" style={{ gridColumn: "span 2" }}><span className="pf-label">Notes</span><TextInput value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
            </div>
            <div className="pf-form-actions"><button className="secondary-button" onClick={resetForm}>Cancel</button><button className="primary-button" onClick={saveInvestor}>Save investor</button></div>
          </div>
        )}
        <div className="pf-panel">
          {investors.length === 0 ? (
            <EmptyState title="No investors on book" body="Investors appear once added." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Investor</th><th className="pf-hide-sm">Instrument</th><th>Investment</th><th className="pf-hide-sm">Equity</th><th className="pf-hide-sm">Report cadence</th><th>Status</th>{canManage && <th>Actions</th>}</tr>
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
                      {canManage && <td><button className="pf-button pf-button-compact" onClick={() => { setEditingId(inv._id); setFormOpen(true); setForm({ name: inv.name, email: inv.email, amount: String(inv.investmentAmountUSD), date: inv.investmentDate, instrumentType: inv.instrumentType, reportFrequency: inv.reportFrequency, notes: inv.notes ?? "" }); }}>Edit</button>{inv.status === "active" && <button className="pf-button pf-button-compact" onClick={() => updateInvestor({ investorId: inv._id, status: "exited" })}>Exit</button>}</td>}
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
                  <tr><th>Period</th><th>Investor</th><th className="pf-hide-sm">Monthly revenue</th><th className="pf-hide-sm">Net contribution</th><th>Generated</th>{canManage && <th>Actions</th>}</tr>
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
                        {canManage && <td>{r.investorId ? <button className="pf-button pf-button-compact" onClick={() => generateReport({ investorId: r.investorId!, period: r.period })}>Regenerate</button> : "—"}</td>}
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
