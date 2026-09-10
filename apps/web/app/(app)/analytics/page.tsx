"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Cpu, MemoryStick, Users, Gauge, Radio, Wifi, Activity } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill } from "@/app/components/ui";

const n = (v: number, d = 1) => v.toLocaleString("en", { maximumFractionDigits: d });

export default function AnalyticsPage() {
  const uptime = useQuery(api.analytics.getDeviceUptimeStats, { days: 14 });

  if (uptime === undefined) return <Loading />;

  const cpuPct = uptime.avgRouterCpuPercent ?? 0;
  const memPct = uptime.avgRouterMemPercent ?? 0;
  const ccq = uptime.avgCcq ?? 0;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Performance</p>
          <h1 className="page-title">Network analytics</h1>
          <p className="page-subtitle">Fleet health over the last 14 days — CPU, memory, load and airtime quality.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Radio} label="Routers" value={uptime.routerCount} tone="primary" detail="Telemetry reporting" />
        <MetricCard icon={Wifi} label="Access points" value={uptime.accessPointCount} tone="accent" detail="Telemetry reporting" />
        <MetricCard icon={Users} label="Peak clients" value={n(uptime.peakConnectedClients, 0)} tone="success" detail="Across the fleet" />
        <MetricCard icon={Cpu} label="Avg gateway CPU" value={`${n(cpuPct, 1)}%`} tone={cpuPct >= 90 ? "danger" : cpuPct >= 70 ? "warning" : "neutral"} detail="Daily average" />
      </div>

      <div className="metric-grid">
        <MetricCard icon={MemoryStick} label="Avg gateway memory" value={`${n(memPct, 1)}%`} tone={memPct >= 90 ? "danger" : memPct >= 70 ? "warning" : "neutral"} detail="Daily average" />
        <MetricCard icon={Gauge} label="Peak throughput" value={`${n(uptime.peakRxMbps, 0)} / ${n(uptime.peakTxMbps, 0)}`} tone="primary" detail="Rx / Tx Mbps" />
        <MetricCard icon={Activity} label="Avg CCQ" value={`${n(ccq, 0)}%`} tone={ccq >= 80 ? "success" : ccq >= 60 ? "warning" : "danger"} detail="Client connection quality" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Snapshot</p><h2>Fleet summary</h2></div>
        </div>
        <div className="pf-panel">
          {uptime.routerCount + uptime.accessPointCount === 0 ? (
            <EmptyState title="No telemetry yet" body="Telemetry appears once routers and access points report in." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Metric</th><th className="pf-hide-sm">Routers</th><th className="pf-hide-sm">Access points</th><th>Reading</th><th>Health</th></tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>CPU utilisation</strong></td>
                    <td className="pf-hide-sm">{n(cpuPct, 1)}% avg</td>
                    <td className="pf-hide-sm">—</td>
                    <td>{n(cpuPct, 1)}%</td>
                    <td><StatusPill tone={cpuPct >= 90 ? "danger" : cpuPct >= 70 ? "warning" : "success"}>{cpuPct >= 90 ? "Overloaded" : cpuPct >= 70 ? "Sustained" : "Healthy"}</StatusPill></td>
                  </tr>
                  <tr>
                    <td><strong>Memory utilisation</strong></td>
                    <td className="pf-hide-sm">{n(memPct, 1)}% avg</td>
                    <td className="pf-hide-sm">—</td>
                    <td>{n(memPct, 1)}%</td>
                    <td><StatusPill tone={memPct >= 90 ? "danger" : memPct >= 70 ? "warning" : "success"}>{memPct >= 90 ? "Overloaded" : memPct >= 70 ? "Sustained" : "Healthy"}</StatusPill></td>
                  </tr>
                  <tr>
                    <td><strong>Client load</strong></td>
                    <td className="pf-hide-sm">peak {n(uptime.peakConnectedClients, 0)}</td>
                    <td className="pf-hide-sm">peak included</td>
                    <td>{n(uptime.peakConnectedClients, 0)} clients</td>
                    <td><StatusPill tone="neutral">Rollup</StatusPill></td>
                  </tr>
                  <tr>
                    <td><strong>Throughput</strong></td>
                    <td className="pf-hide-sm">{n(uptime.peakRxMbps, 0)} Rx / {n(uptime.peakTxMbps, 0)} Tx Mbps</td>
                    <td className="pf-hide-sm">fleet-wide</td>
                    <td>{n(uptime.peakRxMbps, 0)} / {n(uptime.peakTxMbps, 0)} Mbps</td>
                    <td><StatusPill tone="neutral">Peak</StatusPill></td>
                  </tr>
                  <tr>
                    <td><strong>Connection quality</strong></td>
                    <td className="pf-hide-sm">—</td>
                    <td className="pf-hide-sm">{n(ccq, 0)}% avg</td>
                    <td>{n(ccq, 0)}%</td>
                    <td><StatusPill tone={ccq >= 80 ? "success" : ccq >= 60 ? "warning" : "danger"}>{ccq >= 80 ? "Good" : ccq >= 60 ? "Fair" : "Poor"}</StatusPill></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
