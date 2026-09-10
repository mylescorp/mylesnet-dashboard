"use client";

import Link from "next/link";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { useMemo } from "react";
import { MapPin, RadioTower, Wifi, Wrench } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, StatusPill, formatDate } from "@/app/components/ui";

export default function MapPage() {
  const markets = useQuery(api.markets.listMarkets, {});
  const devices = useQuery(api.devices.listDevices, {});

  const byMarket = useMemo(() => {
    const map = new Map<string, { total: number; online: number; pending: number }>();
    for (const device of devices ?? []) {
      const entry = map.get(device.marketId) ?? { total: 0, online: 0, pending: 0 };
      entry.total += 1;
      if (device.status === "online") entry.online += 1;
      if (device.status === "unverified") entry.pending += 1;
      map.set(device.marketId, entry);
    }
    return map;
  }, [devices]);

  if (markets === undefined || devices === undefined) return <Loading />;

  const totalDevices = devices.length;
  const onlineDevices = devices.filter((d) => d.status === "online").length;
  const pendingDevices = devices.filter((d) => d.status === "unverified").length;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="page-title">Market map</h1>
          <p className="page-subtitle">Every live market with its device estate, online status and pending registrations.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={MapPin} label="Live markets" value={markets.length} tone="primary" detail={`${markets.filter((m) => m.lifecycleStatus === "active").length} active`} />
        <MetricCard icon={RadioTower} label="Devices" value={totalDevices} tone="accent" detail="Routers and access points" />
        <MetricCard icon={Wifi} label="Online now" value={onlineDevices} tone="success" detail={`${totalDevices ? Math.round((onlineDevices / totalDevices) * 100) : 0}% of estate`} />
        <MetricCard icon={Wrench} label="Pending approval" value={pendingDevices} tone={pendingDevices > 0 ? "warning" : "neutral"} detail="Self-registered site devices" />
      </div>

      {markets.length === 0 ? (
        <EmptyState title="No markets" body="Create a market to start mapping your estate." />
      ) : (
        <div className="pf-panel">
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Country</th>
                  <th>Lifecycle</th>
                  <th>Devices</th>
                  <th className="pf-hide-sm">Online</th>
                  <th className="pf-hide-sm">Pending</th>
                  <th className="pf-hide-sm">Installed</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => {
                  const stats = byMarket.get(market._id) ?? { total: 0, online: 0, pending: 0 };
                  return (
                    <tr key={market._id}>
                      <td><strong>{market.name}</strong></td>
                      <td>{market.country}</td>
                      <td><StatusPill tone={market.lifecycleStatus === "active" ? "success" : market.lifecycleStatus === "planned" ? "neutral" : "warning"}>{market.lifecycleStatus}</StatusPill></td>
                      <td>{stats.total}</td>
                      <td className="pf-hide-sm">{stats.online}</td>
                      <td className="pf-hide-sm">{stats.pending > 0 ? <StatusPill tone="warning">{stats.pending}</StatusPill> : "—"}</td>
                      <td className="pf-hide-sm">{market.installDate ?? "—"}</td>
                      <td className="pf-actions"><Link className="secondary-button" href={`/markets/${market._id}`}>Open</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {markets.length > 0 && (
        <div className="section-block" aria-label="Estate summary">
          <div className="section-heading">
            <div><p className="eyebrow">Estate</p><h2>Device posture by market</h2></div>
          </div>
          <div className="pf-panel">
            {devices.length === 0 ? (
              <EmptyState title="No devices registered" body="Approved devices appear here as they register and are approved." />
            ) : (
              <div className="pf-table-wrap">
                <table className="pf-table">
                  <thead>
                    <tr>
                      <th>Device</th>
                      <th>Type</th>
                      <th className="pf-hide-sm">Market</th>
                      <th>Status</th>
                      <th className="pf-hide-sm">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device) => (
                      <tr key={device._id}>
                        <td><strong>{device.name}</strong></td>
                        <td>{device.deviceType ?? device.deviceKind}</td>
                        <td className="pf-hide-sm">{markets.find((m) => m._id === device.marketId)?.name ?? "—"}</td>
                        <td><StatusPill tone={device.status === "online" ? "success" : device.status === "deprecated" || device.status === "deleted" ? "danger" : device.status === "unverified" ? "warning" : "neutral"}>{device.status}</StatusPill></td>
                        <td className="pf-hide-sm">{device.lastSeenAt ? formatDate(device.lastSeenAt) : "never"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
