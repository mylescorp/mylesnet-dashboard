"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Router, Wifi, Users, AlertTriangle } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, Select, StatusPill } from "@/app/components/ui";
import type { Id } from "@/convex/_generated/dataModel";

const n = (v: number, d = 0) => v.toLocaleString("en", { maximumFractionDigits: d });

export default function CapacityPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const [marketId, setMarketId] = useState("");
  const overview = useQuery(
    api.capacityPlanning.getCapacityOverview,
    marketId ? { marketId: marketId as Id<"markets">, days: 14 } : { days: 14 },
  );

  if (markets === undefined || overview === undefined) return <Loading />;

  const rows = marketId ? overview.filter((o) => o.marketId === marketId) : overview;
  const totalRouters = rows.reduce((s, r) => s + r.routers, 0);
  const totalAps = rows.reduce((s, r) => s + r.accessPoints, 0);
  const peakClients = rows.reduce((s, r) => Math.max(s, r.peakClients), 0);
  const hotMarkets = rows.filter((r) => r.cpuPctAboveThreshold > 0);

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Performance</p>
          <h1 className="page-title">Capacity planning</h1>
          <p className="page-subtitle">Peak load and headroom per market from the daily telemetry rollup.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <Select value={marketId} onChange={(e) => setMarketId(e.target.value)} aria-label="Filter by market">
            <option value="">All markets</option>
            {markets.map((m) => (
              <option key={m._id} value={m._id}>{m.name}</option>
            ))}
          </Select>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Router} label="Routers" value={totalRouters} tone="primary" detail="Reporting" />
        <MetricCard icon={Wifi} label="Access points" value={totalAps} tone="accent" detail="Reporting" />
        <MetricCard icon={Users} label="Peak clients" value={n(peakClients)} tone="success" detail="Highest seen" />
        <MetricCard icon={AlertTriangle} label="Hot markets" value={hotMarkets.length} tone={hotMarkets.length > 0 ? "danger" : "success"} detail="CPU ≥ 80% days" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Markets</p><h2>Capacity by market</h2></div>
        </div>
        <div className="pf-panel">
          {overview.length === 0 ? (
            <EmptyState title="No telemetry yet" body="Capacity figures appear once the daily rollup has data." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th className="pf-hide-sm">Routers</th>
                    <th className="pf-hide-sm">APs</th>
                    <th>Peak clients</th>
                    <th>Peak Rx/Tx</th>
                    <th className="pf-hide-sm">CCQ</th>
                    <th>CPU days</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.marketId}>
                      <td><strong>{r.marketName}</strong></td>
                      <td className="pf-hide-sm">{r.routers}</td>
                      <td className="pf-hide-sm">{r.accessPoints}</td>
                      <td>{n(r.peakClients)}</td>
                      <td>{n(r.peakRxMbps)}/{n(r.peakTxMbps)} Mbps</td>
                      <td className="pf-hide-sm">{r.avgCcq === undefined ? "—" : `${n(r.avgCcq, 0)}%`}</td>
                      <td>
                        <StatusPill tone={r.cpuPctAboveThreshold > 0 ? "warning" : "success"}>
                          {r.cpuPctAboveThreshold > 0 ? `${r.cpuPctAboveThreshold} over` : "OK"}
                        </StatusPill>
                      </td>
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
          <div><p className="eyebrow">Headroom</p><h2>How to read this</h2></div>
        </div>
        <div className="pf-panel">
          <ul className="pf-muted" style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 8 }}>
            <li><b>Peak clients</b> — highest concurrent clients seen in the window; plan upgrades when peak crosses ~80% of gateway capacity.</li>
            <li><b>CPU days</b> — days a gateway averaged ≥ 80% CPU. Sustained hot markets are upgrade candidates.</li>
            <li><b>CCQ</b> — airtime quality for access points; below 60% suggests interference or oversubscription.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
