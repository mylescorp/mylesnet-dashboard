"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { PiggyBank, CircleDollarSign, TrendingDown, TrendingUp } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, Select, StatusPill } from "@/app/components/ui";

const n = (v: number, d = 2) => v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function ProfitabilityPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const rows = useQuery(api.expenses.listAllFinancials, {});
  const [month, setMonth] = useState("");

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows ?? []) set.add(r.month);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [rows]);

  const effectiveMonth = month || months[0] || "—";
  const filtered = useMemo(() => (rows ?? []).filter((r) => r.month === effectiveMonth), [rows, effectiveMonth]);

  if (markets === undefined || rows === undefined) return <Loading />;

  const name = (id: string) => markets.find((m) => m._id === id)?.name ?? id;
  const totalRevenueUSD = filtered.reduce((s, r) => s + r.revenueUSD, 0);
  const totalNetLocal = filtered.reduce((s, r) => s + r.netContributionLocal, 0);
  const lossMarkets = filtered.filter((r) => r.breakEvenStatus === "loss");

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Business</p>
          <h1 className="page-title">Profitability</h1>
          <p className="page-subtitle">Per-market monthly financials — revenue, variable cost and net contribution.</p>
        </div>
        {months.length > 0 && (
          <div style={{ minWidth: 220 }}>
            <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Report month">
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
        )}
      </div>

      <div className="metric-grid">
        <MetricCard icon={CircleDollarSign} label="Revenue (USD)" value={n(totalRevenueUSD)} tone="primary" detail={effectiveMonth} />
        <MetricCard icon={PiggyBank} label="Net contribution" value={n(totalNetLocal)} tone={totalNetLocal >= 0 ? "success" : "danger"} detail="Local, all markets" />
        <MetricCard icon={TrendingUp} label="Markets reporting" value={filtered.length} tone="accent" detail="Month financials" />
        <MetricCard icon={TrendingDown} label="Loss markets" value={lossMarkets.length} tone={lossMarkets.length > 0 ? "danger" : "success"} detail={lossMarkets.length ? lossMarkets.map((r) => name(r.marketId)).join(", ") : "None"} />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Month sheet</p><h2>Market contribution</h2></div>
        </div>
        <div className="pf-panel">
          {filtered.length === 0 ? (
            <EmptyState title="No monthly financials" body="Market financials appear once recorded for a month." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Revenue local</th>
                    <th className="pf-hide-sm">Variable cost</th>
                    <th className="pf-hide-sm">Net contribution</th>
                    <th>Currency</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r) => (
                    <tr key={`${r.marketId}-${r.month}`}>
                      <td><strong>{name(r.marketId)}</strong></td>
                      <td>{n(r.revenueLocal)}</td>
                      <td className="pf-hide-sm">{n(r.variableCostLocal)}</td>
                      <td className="pf-hide-sm">{n(r.netContributionLocal)}</td>
                      <td>{r.currency}</td>
                      <td><StatusPill tone={r.breakEvenStatus === "profit" ? "success" : r.breakEvenStatus === "break_even" ? "neutral" : "danger"}>{r.breakEvenStatus.replace("_", " ")}</StatusPill></td>
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
