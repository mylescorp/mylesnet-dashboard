"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { fleet } from "@/lib/convex/fleet";

export function PlatformDeviceDetail({ deviceId }: { deviceId: string }) {
  const row = useQuery(fleet.get, { deviceId });

  if (row === undefined) return <p className="pf-muted">Loading device…</p>;
  if (row === null) return <p className="pf-muted">Device not found.</p>;

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <Link href="/platform/infrastructure/devices" className="platform-back-link">
              <ArrowLeft size={15} aria-hidden="true" />Device fleet
            </Link>
          </p>
          <h1 className="page-title">{row.name}</h1>
          <p className="page-subtitle">{row.deviceKind}</p>
        </div>
        <span className={`pf-badge pf-badge-${row.provisioningStatus === "provisioned" ? "success" : row.provisioningStatus === "failed" ? "danger" : row.provisioningStatus === "pending" ? "warning" : "neutral"}`}>
          {row.provisioningStatus ?? "unprovisioned"}
        </span>
      </header>

      <section className="metric-grid" aria-label="Device summary">
        <Metric label="Last seen" value={row.lastSeenAt ? new Date(row.lastSeenAt).toLocaleString() : "Never"} />
        <Metric label="Uptime" value={row.uptimePercent != null ? `${row.uptimePercent.toFixed(1)}%` : "—"} />
        <Metric label="Firmware" value={row.firmwareVersion ?? "—"} />
        <Metric label="Lifecycle" value={row.lifecycleStatus} />
      </section>

      <section className="section-heading"><div><p className="eyebrow">Ownership</p><h2>Tenant &amp; market</h2></div></section>
      <div className="form-grid">
        <div className="pf-field"><span className="pf-label">Tenant</span><p className="pf-static">{row.tenantName ?? row.tenantId ?? "—"}</p></div>
        <div className="pf-field"><span className="pf-label">Market</span><p className="pf-static">{row.marketName ?? row.marketId}</p></div>
        <div className="pf-field"><span className="pf-label">Model / kind</span><p className="pf-static">{row.deviceKind}</p></div>
        <div className="pf-field"><span className="pf-label">Registered by</span><p className="pf-static">{row.registeredBy ?? "—"}</p></div>
        <div className="pf-field"><span className="pf-label">Registered</span><p className="pf-static">{row.registeredAt ? new Date(row.registeredAt).toLocaleString() : "—"}</p></div>
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
    </div>
  );
}