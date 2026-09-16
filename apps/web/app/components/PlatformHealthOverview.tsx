"use client";

import { useMemo, useState } from "react";
import { HeartPulse } from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { useUserProfile } from "./UserProfileContext";
import {
  healthRollup,
  type HealthTone,
  type PlatformHealthOverview,
} from "@/lib/convex/healthRollup";

const TONE_TONE: Record<HealthTone, string> = {
  ok: "success",
  warning: "warning",
  critical: "critical",
  unknown: "neutral",
};

export function PlatformHealthOverview() {
  const { user } = useUserProfile();
  const data = useQuery(healthRollup.overview, {});
  const [selectedRouter, setSelectedRouter] = useState<string | null>(null);

  const detail = useQuery(
    healthRollup.routerDetail,
    selectedRouter ? { routerId: selectedRouter } : "skip",
  );

  const visibleDevices = useMemo(() => {
    if (!data) return undefined;
    if (data.routerRows.length === 0) return data.deviceRows;
    if (!selectedRouter) return data.deviceRows;
    return data.deviceRows.filter((d) => d.routerId === selectedRouter);
  }, [data, selectedRouter]);

  const toneStyle = (tone: HealthTone) =>
    `pf-badge pf-badge-${TONE_TONE[tone]}`;

  const fmtMbps = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)} Mbps`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)} Kbps`;
    return `${v} Bps`;
  };

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Network health</h1>
          <p className="page-subtitle">
            Live telemetry and outage posture across the estate: the fleet device
            registry, router + access-point samples, and open offline alerts.
            Read-only rollup over the existing ops data.
          </p>
        </div>
      </header>

      {!data ? (
        <p className="pf-muted">Loading network health…</p>
      ) : (
        <>
          <section className="metric-grid" aria-label="Platform health summary">
            <Metric
              label="Devices"
              value={data.overview.devices.total}
              detail={`${data.overview.devices.byTone.critical} critical · ${data.overview.devices.byTone.warning} warning · ${data.overview.devices.byTone.ok} ok`}
            />
            <Metric
              label="Routers"
              value={data.overview.routers.total}
              detail={`${data.overview.routers.withRecentSample} reporting samples`}
            />
            <Metric
              label="Open alerts"
              value={data.overview.openAlerts.total}
              detail={`${data.overview.openAlerts.critical} critical · ${data.overview.openAlerts.warning} warning`}
            />
            <Metric
              label="Avg device uptime"
              value={
                data.overview.devices.averageUptimePercent === null
                  ? "—"
                  : `${data.overview.devices.averageUptimePercent}%`
              }
              detail="over fleet"
            />
          </section>

          <section className="section-heading">
            <div>
              <p className="eyebrow">Fleet</p>
              <h2>Device tones</h2>
            </div>
          </section>

          {data.routerRows.length === 0 ? (
            <div className="tenant-empty-state">
              <HeartPulse size={26} aria-hidden="true" />
              <h3>No platform routers</h3>
              <p>Routers, devices and health samples will appear here.</p>
            </div>
          ) : (
            <div className="table-scroll">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Router</th>
                    <th>Market</th>
                    <th>CPU</th>
                    <th>Mem</th>
                    <th>Link</th>
                    <th>Traffic</th>
                    <th>Tone</th>
                  </tr>
                </thead>
                <tbody>
                  {data.routerRows.map((router) => (
                    <tr
                      key={router._id}
                      onClick={() =>
                        setSelectedRouter(
                          selectedRouter === router._id ? null : router._id,
                        )
                      }
                      className="pf-row-clickable"
                    >
                      <td className="pf-cell-main">{router.name}</td>
                      <td>{router.marketName ?? "—"}</td>
                      <td>
                        {router.latest ? `${router.latest.cpuPercent}%` : "—"}
                      </td>
                      <td>
                        {router.latest
                          ? `${router.latest.memoryPercent}%`
                          : "—"}
                      </td>
                      <td>
                        {router.latest
                          ? router.latest.linkState
                            ? "up"
                            : "down"
                          : "—"}
                      </td>
                      <td>
                        {router.latest
                          ? `${fmtMbps(router.latest.txBytesPerSec)}/s ↓`
                          : "—"}
                      </td>
                      <td>
                        <span className={toneStyle(router.tone)}>
                          {router.tone}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {selectedRouter &&
            (detail ? (
              <section className="section-heading">
                <div>
                  <p className="eyebrow">Access points</p>
                  <h2>{detail.name}</h2>
                </div>
              </section>
            ) : null)}
          {selectedRouter && detail ? (
            detail.accessPointHealth.length === 0 ? (
              <p className="pf-muted">No access points on this router.</p>
            ) : (
              <div className="table-scroll">
                <table className="pf-table">
                  <thead>
                    <tr>
                      <th>Access point</th>
                      <th>Link</th>
                      <th>Clients</th>
                      <th>CCQ</th>
                      <th>Signal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.accessPointHealth.map((ap) => (
                      <tr key={ap.accessPointId}>
                        <td className="pf-cell-main">{ap.name}</td>
                        <td>
                          {ap.latest
                            ? ap.latest.linkState
                              ? "up"
                              : "down"
                            : "—"}
                        </td>
                        <td>{ap.latest?.connectedUserCount ?? "—"}</td>
                        <td>{ap.latest?.ccq ?? "—"}</td>
                        <td>{ap.latest?.signalStrengthDbm ?? "—"} dBm</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          ) : null}

          <section className="section-heading">
            <div>
              <p className="eyebrow">Fleet devices</p>
              <h2>
                {selectedRouter
                  ? `Devices on ${data.routerRows.find((r) => r._id === selectedRouter)?.name ?? ""}`
                  : "All devices"}
              </h2>
            </div>
          </section>

          {visibleDevices && visibleDevices.length === 0 ? (
            <p className="pf-muted">No devices for this router.</p>
          ) : (
            <div className="table-scroll">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Device</th>
                    <th>Kind</th>
                    <th>Market</th>
                    <th>Tenant</th>
                    <th>Firmware</th>
                    <th>Uptime</th>
                    <th>Last seen</th>
                    <th>Tone</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleDevices?.map((device) => (
                    <tr key={device._id}>
                      <td className="pf-cell-main">{device.name}</td>
                      <td>{device.deviceKind}</td>
                      <td>{device.marketName ?? "—"}</td>
                      <td>{device.tenantName ?? "—"}</td>
                      <td>{device.firmwareVersion ?? "—"}</td>
                      <td>
                        {device.uptimePercent === null
                          ? "—"
                          : `${device.uptimePercent}%`}
                      </td>
                      <td>
                        {device.lastSeenAt === null
                          ? "never"
                          : new Date(device.lastSeenAt).toLocaleString()}
                      </td>
                      <td>
                        <span className={toneStyle(device.tone)}>
                          {device.tone}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}