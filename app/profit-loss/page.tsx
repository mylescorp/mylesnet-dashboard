"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Landmark, PiggyBank, Receipt, TrendingDown } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import SimpleBars from "@/app/components/SimpleBars";
import { EmptyState, Loading, Select, StatusPill } from "@/app/components/ui";

const n = (v: number, d = 2) => v.toLocaleString("en", { minimumFractionDigits: d, maximumFractionDigits: d });

export default function ProfitLossPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const financials = useQuery(api.expenses.listAllFinancials, {});

  const months = useMemo(() => {
    const set = new Set<string>();
    for (const r of financials ?? []) set.add(r.month);
    return [...set].sort((a, b) => b.localeCompare(a));
  }, [financials]);

  const [month, setMonth] = useState("");
  const effectiveMonth = month || months[0] || "";

  const allocation = useQuery(api.costAllocation.getCostAllocation, effectiveMonth ? { month: effectiveMonth } : "skip");

  const trend = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of financials ?? []) map.set(r.month, (map.get(r.month) ?? 0) + r.netContributionLocal);
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label, value }));
  }, [financials]);

  if (markets === undefined || financials === undefined || allocation === undefined) return <Loading />;

  const name = (id: string) => markets.find((m) => m._id === id)?.name ?? id;

  const totals = allocation.totals;
  const usdNet = allocation.totalsUsdNetContribution;
  const lossMarkets = allocation.markets.filter((m) => m.netContributionLocal < 0);

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="page-title">Profit & loss</h1>
          <p className="page-subtitle">Monthly P&L by market — revenue against variable and allocated fixed costs.</p>
        </div>
        {months.length > 0 && (
          <div style={{ minWidth: 220 }}>
            <Select value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Report month">
              {months.map((m) => <option key={m} value={m}>{m}</option>)}
            </Select>
          </div>
        )}
      </div>

      {effectiveMonth ? (
        <>
          <div className="metric-grid">
            <MetricCard icon={Landmark} label="Revenue" value={n(totals.revenueLocal)} tone="primary" detail={effectiveMonth} />
            <MetricCard icon={PiggyBank} label="Net contribution" value={n(totals.netContributionLocal)} tone={totals.netContributionLocal >= 0 ? "success" : "danger"} detail={`≈ $${n(usdNet)}`} />
            <MetricCard icon={Receipt} label="Markets" value={allocation.markets.length} tone="accent" detail="Allocated" />
            <MetricCard icon={TrendingDown} label="Loss markets" value={lossMarkets.length} tone={lossMarkets.length > 0 ? "danger" : "success"} detail="Net negative" />
          </div>

          <div className="section-block">
            <div className="section-heading">
              <div><p className="eyebrow">P&L</p><h2>Per-market contribution — {effectiveMonth}</h2></div>
            </div>
            <div className="pf-panel">
              {allocation.markets.length === 0 ? (
                <EmptyState title="No market rows" body="Market financials for this month will appear here." />
              ) : (
                <div className="pf-table-wrap">
                  <table className="pf-table">
                    <thead>
                      <tr>
                        <th>Market</th>
                        <th>Revenue</th>
                        <th className="pf-hide-sm">Variable</th>
                        <th className="pf-hide-sm">Fixed (alloc.)</th>
                        <th>Net contribution</th>
                        <th className="pf-hide-sm">Currency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocation.markets.map((m) => (
                        <tr key={m.marketId}>
                          <td><strong>{name(m.marketId)}</strong></td>
                          <td>{n(m.revenueLocal)}</td>
                          <td className="pf-hide-sm">−{n(m.variableCostLocal)}</td>
                          <td className="pf-hide-sm">−{n(m.fixedCostLocal)}{m.nationalFixedAllocated ? <span className="pf-muted"> (nat.)</span> : null}</td>
                          <td><StatusPill tone={m.netContributionLocal >= 0 ? "success" : "danger"}>{n(m.netContributionLocal)}</StatusPill></td>
                          <td className="pf-hide-sm">{m.currency}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {allocation.national && allocation.national.fixedLocal > 0 && (
            <p className="pf-muted" style={{ marginTop: 8 }}>
              National fixed costs ({n(allocation.national.fixedLocal)} {allocation.national.currency}) allocated pro-rata by revenue in each currency pool.
            </p>
          )}

          <div className="section-block">
            <div className="section-heading">
              <div><p className="eyebrow">Trailing</p><h2>Net contribution by month</h2></div>
            </div>
            <div className="pf-panel">
              {trend.length === 0 ? (
                <EmptyState title="No monthly rows yet" body="Month financials will render a trend once recorded." />
              ) : (
                <SimpleBars data={trend} formatTick={(v) => n(v, 0)} />
              )}
            </div>
          </div>
        </>
      ) : (
        <div className="pf-panel">
          <EmptyState title="No financials recorded" body="Record monthly market financials to unlock the P&L." />
        </div>
      )}
    </div>
  );
}
