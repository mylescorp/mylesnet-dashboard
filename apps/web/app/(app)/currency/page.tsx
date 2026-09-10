"use client";

import { useMemo } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Coins, RefreshCcw, Activity } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill, formatDateTime } from "@/app/components/ui";
import type { Doc } from "@/convex/_generated/dataModel";

const n = (v: number) => v.toLocaleString("en", { maximumFractionDigits: 4 });

export default function CurrencyPage() {
  const rates = useQuery(api.forex.listExchangeRates, { limit: 50 });

  const currencies = useMemo(() => {
    const map = new Map<string, Doc<"exchangeRates">>();
    for (const r of rates ?? []) {
      const prev = map.get(r.currency);
      if (!prev || r.date > prev.date) map.set(r.currency, r);
    }
    return [...map.values()].sort((a, b) => a.currency.localeCompare(b.currency));
  }, [rates]);

  if (rates === undefined) return <Loading />;

  const latestDate = rates.length ? rates[rates.length - 1].date : undefined;
  const primary = rates.filter((r) => r.source === "primary").length;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="page-title">Currency</h1>
          <p className="page-subtitle">FX rates used for USD conversion in financials, payouts and investor reporting.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Coins} label="Currencies tracked" value={currencies.length} tone="primary" detail="With USD rate" />
        <MetricCard icon={Activity} label="Latest rate date" value={latestDate ?? "—"} tone="accent" detail="Most recent refresh" />
        <MetricCard icon={RefreshCcw} label="Primary sources" value={primary} tone="success" detail="Non-fallback fetches" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Rates</p><h2>Latest per currency</h2></div>
        </div>
        <div className="pf-panel">
          {currencies.length === 0 ? (
            <EmptyState title="No FX rates yet" body="Exchange rates appear once the finance sync has run." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Currency</th>
                    <th>Rate to USD</th>
                    <th className="pf-hide-sm">Date</th>
                    <th>Source</th>
                    <th className="pf-hide-sm">Refreshed</th>
                  </tr>
                </thead>
                <tbody>
                  {currencies.map((c) => (
                    <tr key={c.currency}>
                      <td><strong>{c.currency}</strong></td>
                      <td>{n(c.rateToUSD)}</td>
                      <td className="pf-hide-sm">{c.date}</td>
                      <td><StatusPill tone={c.source === "primary" ? "success" : "warning"}>{c.source}</StatusPill></td>
                      <td className="pf-hide-sm">{formatDateTime(c.refreshedAt)}</td>
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
