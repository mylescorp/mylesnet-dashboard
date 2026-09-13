"use client";

import { useMemo } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { ShieldAlert, AlertTriangle, Info } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill } from "@/app/components/ui";

const toneFor = (severity: string) => (severity === "critical" ? "danger" : severity === "warning" ? "warning" : "neutral");

export default function RiskPage() {
  const overview = useQuery(api.riskCenter.getRiskOverview, {});
  const markets = useQuery(api.markets.listMarkets, {});

  const byCategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of overview?.items ?? []) map.set(item.category, (map.get(item.category) ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [overview]);

  if (overview === undefined || markets === undefined) return <Loading />;

  const critical = overview.counts.critical;
  const warning = overview.counts.warning;
  const info = overview.counts.info;
  const name = (id?: string) => (id ? markets.find((m) => m._id === id)?.name ?? id : "Fleet-wide");

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Performance</p>
          <h1 className="page-title">Risk center</h1>
          <p className="page-subtitle">Live risk findings across the network — offline devices, overloaded gateways and churn risk.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={ShieldAlert} label="Critical" value={critical} tone={critical > 0 ? "danger" : "success"} detail={critical > 0 ? "Action needed" : "All clear"} />
        <MetricCard icon={AlertTriangle} label="Warnings" value={warning} tone={warning > 0 ? "warning" : "neutral"} detail="Monitor" />
        <MetricCard icon={Info} label="Info" value={info} tone="accent" detail="Advisory" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Findings</p><h2>Risk items</h2></div>
        </div>
        <div className="pf-panel">
          {overview.items.length === 0 ? (
            <EmptyState title="No active risk findings" body="Live checks come back clean right now." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Severity</th><th>Category</th><th>Market</th><th>Finding</th><th className="pf-hide-sm">Metric</th></tr>
                </thead>
                <tbody>
                  {overview.items.map((item, i) => (
                    <tr key={i}>
                      <td><strong><StatusPill tone={toneFor(item.severity)}>{item.severity}</StatusPill></strong></td>
                      <td>{item.category.replaceAll("_", " ")}</td>
                      <td>{name(item.marketId)}</td>
                      <td>{item.message}</td>
                      <td className="pf-hide-sm">{item.metric}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {byCategory.length > 0 && (
        <div className="section-block">
          <div className="section-heading">
            <div><p className="eyebrow">Heatmap</p><h2>Categories</h2></div>
          </div>
          <div className="pf-panel">
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Category</th><th>Findings</th></tr></thead>
                <tbody>
                  {byCategory.map(([category, count]) => (
                    <tr key={category}>
                      <td><strong>{category.replaceAll("_", " ")}</strong></td>
                      <td>{count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

