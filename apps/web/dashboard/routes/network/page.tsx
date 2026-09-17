"use client";

import { useQuery } from "@/app/lib/convex";
import { PageHeader } from "@mylesnet/ui";
import { Wifi, Signal, MonitorSmartphone, AlertTriangle } from "lucide-react";
import { StatusPill, formatDateTime } from "@/shared/components/ui";
import { networkOps } from "@/shared/convex/networkOps";

export default function NetworkSessionsPage() {
  const data = useQuery(networkOps.listLiveSessions, {});

  if (data === undefined) {
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">Loading live sessions…</div>
      </div>
    );
  }

  const { sessions, stats } = data;

  return (
    <div className="workspace-page">
      <PageHeader
        eyebrow="Network"
        title="Live sessions"
        description="Currently-served subscribers derived from the tenant ledger"
      />

      <div className="metric-grid">
        <div className="pf-panel">
          <Wifi size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Live now</p>
          <strong style={{ fontSize: "22px" }}>{stats.totalLive}</strong>
        </div>
        <div className="pf-panel">
          <Signal size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>PPPoE</p>
          <strong style={{ fontSize: "22px" }}>{stats.byConnectionType.pppoe}</strong>
        </div>
        <div className="pf-panel">
          <MonitorSmartphone size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Hotspot</p>
          <strong style={{ fontSize: "22px" }}>{stats.byConnectionType.hotspot}</strong>
        </div>
        <div className="pf-panel">
          <AlertTriangle size={20} aria-hidden="true" />
          <p style={{ margin: 0, fontSize: "12px", color: "var(--muted)" }}>Expiring ≤ 7 days</p>
          <strong style={{ fontSize: "22px" }}>{stats.atRiskSoon}</strong>
        </div>
      </div>

      <div className="pf-panel">
        <div className="pf-table-wrap">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Account</th>
                <th>Username</th>
                <th className="pf-hide-sm">IP address</th>
                <th className="pf-hide-lg">MAC address</th>
                <th>Type</th>
                <th className="pf-hide-sm">Plan</th>
                <th>Expiry</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.length === 0 && (
                <tr>
                  <td colSpan={8} className="pf-muted">No subscribers are currently live.</td>
                </tr>
              )}
              {sessions.map((s) => (
                <tr key={s.id}>
                  <td>
                    <strong>{s.name}</strong>
                    <div className="pf-muted">{s.accountNumber}</div>
                  </td>
                  <td>{s.username ?? "\u2014"}</td>
                  <td className="pf-hide-sm"><code>{s.ipAddress ?? "\u2014"}</code></td>
                  <td className="pf-hide-lg"><code>{s.macAddress ?? "\u2014"}</code></td>
                  <td>
                    <StatusPill tone={s.connectionType === "pppoe" ? "success" : "neutral"}>
                      {s.connectionType}
                    </StatusPill>
                  </td>
                  <td className="pf-hide-sm">{s.plan ? s.plan.name : "\u2014"}</td>
                  <td>
                    {s.expiryDate ? formatDateTime(s.expiryDate) : "No expiry"}
                    {s.daysRemaining !== null && (
                      <div className="pf-muted">{s.daysRemaining}d remaining</div>
                    )}
                  </td>
                  <td><StatusPill tone="success">live</StatusPill></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}