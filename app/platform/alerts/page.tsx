"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { StatusPill, EmptyState, Loading, ErrorNote, formatDateTime } from "../components/ui";

const tone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  open: "danger", acknowledged: "warning", resolved: "success",
};

export default function AlertsPage() {
  const [filter, setFilter] = useState<"open" | "all">("open");
  const alerts = useQuery(api.alerts.listAlerts, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const devices = useQuery(api.devices.listDevices, {});
  const acknowledge = useMutation(api.alerts.acknowledgeAlert);
  const resolve = useMutation(api.alerts.resolveAlert);
  const [error, setError] = useState<string | null>(null);

  if (alerts === undefined || markets === undefined || devices === undefined) return <Loading />;

  const marketName = (id: string) => markets.find((m) => m._id === id)?.name ?? `#${String(id).slice(-6)}`;
  const deviceName = (id: string) => devices.find((d) => d._id === id)?.name ?? `#${String(id).slice(-6)}`;

  const visible = filter === "open" ? alerts.filter((a) => a.alertStatus === "open") : alerts;

  const run = async (fn: () => Promise<unknown>) => {
    setError(null);
    try { await fn(); } catch (err) { setError(err instanceof Error ? err.message : "Action failed"); }
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Alerts</h1>
          <p className="page-subtitle">Root-cause grouped device alerts — one alert per outage, not one per AP.</p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          <button type="button" className={filter === "open" ? "primary-button" : "secondary-button"} onClick={() => setFilter("open")}>Open ({alerts.filter((a) => a.alertStatus === "open").length})</button>
          <button type="button" className={filter === "all" ? "primary-button" : "secondary-button"} onClick={() => setFilter("all")}>All ({alerts.length})</button>
        </div>
      </div>

      <div className="pf-panel">
        {visible.length === 0 ? (
          <EmptyState title="No alerts" body="All clear right now." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Message</th>
                  <th className="pf-hide-sm">Market</th>
                  <th>Root device</th>
                  <th>Dependents</th>
                  <th>Status</th>
                  <th className="pf-hide-sm">Opened</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((a) => (
                  <tr key={a._id}>
                    <td><strong>{a.message}</strong></td>
                    <td className="pf-hide-sm">{marketName(a.marketId)}</td>
                    <td>{deviceName(a.rootDeviceId)}</td>
                    <td>{a.dependentDeviceIds.length > 0 ? a.dependentDeviceIds.length : "†"}</td>
                    <td><StatusPill tone={tone[a.alertStatus]}>{a.alertStatus}</StatusPill></td>
                    <td className="pf-hide-sm">{formatDateTime(a.openedAt)}</td>
                    <td className="pf-actions">
                      {a.alertStatus === "open" && (
                        <button type="button" className="secondary-button" onClick={() => run(() => acknowledge({ alertId: a._id }))}>Acknowledge</button>
                      )}
                      {(a.alertStatus === "open" || a.alertStatus === "acknowledged") && (
                        <button type="button" className="primary-button" onClick={() => run(() => resolve({ alertId: a._id }))}>Resolve</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
