"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Cpu, MemoryStick, Users, Gauge, Radio, Wifi, Activity } from "lucide-react";
import { PageHeader, MetricCard, EmptyState, StatusPill } from "@mylesnet/ui";
import { Loading } from "@/app/components/ui";

const n = (v: number, d = 1) => v.toLocaleString("en", { maximumFractionDigits: d });

export default function AnalyticsPage() {
  const uptime = useQuery(api.analytics.getDeviceUptimeStats, { days: 14 });

  if (uptime === undefined) return <Loading />;

  const cpuPct = uptime.avgRouterCpuPercent ?? 0;
  const memPct = uptime.avgRouterMemPercent ?? 0;
  const ccq = uptime.avgCcq ?? 0;

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Performance"
        title="Network analytics"
        description="Fleet health over the last 14 days — CPU, memory, load and airtime quality."
      />

      <div className="metric-grid">
        <MetricCard icon={<Radio size={24} />} label="Routers" value={uptime.routerCount} hint="Telemetry reporting" />
        <MetricCard icon={<Wifi size={24} />} label="Access points" value={uptime.accessPointCount} hint="Telemetry reporting" />
        <MetricCard icon={<Users size={24} />} label="Peak clients" value={n(uptime.peakConnectedClients, 0)} hint="Across the fleet" />
        <MetricCard icon={<Cpu size={24} />} label="Avg gateway CPU" value={`${n(cpuPct, 1)}%`} deltaTone={cpuPct >= 90 ? "down" : cpuPct >= 70 ? "flat" : "up"} hint="Daily average" />
      </div>

      <div className="metric-grid">
        <MetricCard icon={<MemoryStick size={24} />} label="Avg gateway memory" value={`${n(memPct, 1)}%`} deltaTone={memPct >= 90 ? "down" : memPct >= 70 ? "flat" : "up"} hint="Daily average" />
        <MetricCard icon={<Gauge size={24} />} label="Peak throughput" value={`${n(uptime.peakRxMbps, 0)} / ${n(uptime.peakTxMbps, 0)}`} hint="Rx / Tx Mbps" />
        <MetricCard icon={<Activity size={24} />} label="Avg CCQ" value={`${n(ccq, 0)}%`} deltaTone={ccq >= 80 ? "up" : ccq >= 60 ? "flat" : "down"} hint="Client connection quality" />
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
