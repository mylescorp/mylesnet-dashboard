"use client";

import { useMemo, useState } from "react";
import { Cpu, Save } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "./UserProfileContext";
import { fleet, type FleetRow } from "@/lib/convex/fleet";

const STATUS_FILTERS = [
  { key: "all", label: "All devices" },
  { key: "unprovisioned", label: "Unprovisioned" },
  { key: "pending", label: "Pending" },
  { key: "provisioned", label: "Provisioned" },
  { key: "failed", label: "Failed" },
] as const;

type StatusTone = "neutral" | "warning" | "success" | "danger";
const STATUS_TONE: Record<string, StatusTone> = {
  unprovisioned: "neutral",
  pending: "warning",
  provisioned: "success",
  failed: "danger",
};

const canEdit = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) =>
    ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug),
  );

export function PlatformDeviceFleet() {
  const { user } = useUserProfile();
  const fleetRows = useQuery(fleet.list, {});
  const updateFleet = useMutation(fleet.update);
  const [filter, setFilter] = useState<string>("all");
  const [editRow, setEditRow] = useState<FleetRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = canEdit(user?.roles);

  const visible = useMemo(() => {
    if (!fleetRows) return undefined;
    if (filter === "all") return fleetRows;
    return fleetRows.filter((row) => row.provisioningStatus === filter);
  }, [fleetRows, filter]);

  const metrics = useMemo(() => ({
    total: fleetRows?.length ?? 0,
    provisioned: fleetRows?.filter((r) => r.provisioningStatus === "provisioned").length ?? 0,
    pending: fleetRows?.filter((r) => r.provisioningStatus === "pending").length ?? 0,
    failed: fleetRows?.filter((r) => r.provisioningStatus === "failed").length ?? 0,
  }), [fleetRows]);

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Device fleet</h1>
          <p className="page-subtitle">
            Devices across every tenant — firmware version, last-seen time, uptime, and provisioning posture.
          </p>
        </div>
      </header>

      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
      {notice ? <p className="platform-notice" role="status">{notice}</p> : null}

      <section className="metric-grid" aria-label="Device fleet summary">
        <Metric label="Devices" value={metrics.total} detail="registered across all markets" />
        <Metric label="Provisioned" value={metrics.provisioned} detail="live in the managed estate" />
        <Metric label="Pending" value={metrics.pending} detail="awaiting provisioning" />
        <Metric label="Failed" value={metrics.failed} detail="needs attention" />
      </section>

      <section className="section-heading">
        <div><p className="eyebrow">Fleet</p><h2>Device registry</h2></div>
        <div className="tab-row" role="tablist" aria-label="Filter devices">
          {STATUS_FILTERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={filter === key}
              className={`tab-button ${filter === key ? "tab-button-active" : ""}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {fleetRows === undefined ? (
        <p className="pf-muted">Loading fleet…</p>
      ) : visible?.length === 0 ? (
        <div className="tenant-empty-state">
          <Cpu size={26} aria-hidden="true" />
          <h3>No {filter === "all" ? "" : `${filter} `}devices</h3>
          <p>Devices register through the provisioning flow or site telemetry. Once provisioned, they appear here.</p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Tenant</th>
                <th>Market</th>
                <th>Model</th>
                <th>Firmware</th>
                <th>Last seen</th>
                <th>Uptime %</th>
                <th>Status</th>
                {editable ? <th className="pf-action-col">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible?.map((row) => (
                <tr key={row._id}>
                  <td className="pf-cell-main">{row.name}</td>
                  <td>{row.tenantName ?? row.tenantId ?? "—"}</td>
                  <td>{row.marketName ?? row.marketId}</td>
                  <td>{row.deviceKind}</td>
                  <td>{row.firmwareVersion ?? "—"}</td>
                  <td>{row.lastSeenAt ? formatTimestamp(row.lastSeenAt) : "Never"}</td>
                  <td>{row.uptimePercent != null ? row.uptimePercent.toFixed(1) : "—"}</td>
                  <td>
                    <span className={`pf-badge pf-badge-${STATUS_TONE[row.provisioningStatus ?? "unprovisioned"]}`}>
                      {row.provisioningStatus ?? "unprovisioned"}
                    </span>
                  </td>
                  {editable ? (
                    <td className="pf-action-col">
                      <button type="button" className="secondary-button" onClick={() => setEditRow(row)}>Edit</button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && editable ? (
        <DeviceEditor
          row={editRow}
          onClose={() => setEditRow(null)}
          onSave={async (input) => {
            setError(null); setNotice(null);
            try {
              await updateFleet(input);
              setEditRow(null);
              setNotice("Device fleet profile updated.");
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Update failed.");
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}

function DeviceEditor(
  { row, onClose, onSave }: {
    row: FleetRow;
    onClose: () => void;
    onSave: (input: {
      deviceId: string;
      firmwareVersion?: string;
      uptimePercent?: number;
      provisioningStatus?: "unprovisioned" | "pending" | "provisioned" | "failed";
    }) => Promise<void>;
  },
) {
  const [firmwareVersion, setFirmwareVersion] = useState(row.firmwareVersion ?? "");
  const [uptimePercent, setUptimePercent] = useState(row.uptimePercent ?? 0);
  const [provisioningStatus, setProvisioningStatus] = useState(row.provisioningStatus ?? "unprovisioned");
  const [working, setWorking] = useState(false);

  return (
    <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Edit device fleet metadata" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="profile-modal-dialog" onSubmit={async (event) => {
        event.preventDefault();
        setWorking(true);
        await onSave({
          deviceId: row._id,
          firmwareVersion: firmwareVersion.trim() || undefined,
          uptimePercent,
          provisioningStatus,
        });
        setWorking(false);
      }}>
        <header className="profile-modal-header">
          <div>
            <p className="eyebrow">Device fleet</p>
            <h2 className="page-title">{row.name}</h2>
          </div>
          <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <div className="modal-body">
          <div className="form-grid">
            <div className="pf-field"><span className="pf-label">Tenant</span><p className="pf-static">{row.tenantName ?? row.tenantId ?? "—"}</p></div>
            <div className="pf-field"><span className="pf-label">Market</span><p className="pf-static">{row.marketName ?? row.marketId}</p></div>
            <label className="pf-field pf-field-wide">
              <span className="pf-label">Firmware version</span>
              <input className="pf-input" value={firmwareVersion} onChange={(event) => setFirmwareVersion(event.target.value)} placeholder="e.g. v6.49.10" />
            </label>
            <label className="pf-field">
              <span className="pf-label">Uptime %</span>
              <input className="pf-input" type="number" min={0} max={100} step={0.1} value={uptimePercent} onChange={(event) => setUptimePercent(Number(event.target.value))} />
            </label>
            <label className="pf-field">
              <span className="pf-label">Provisioning status</span>
              <select className="pf-input" value={provisioningStatus} onChange={(event) => setProvisioningStatus(event.target.value as typeof provisioningStatus)}>
                <option value="unprovisioned">Unprovisioned</option>
                <option value="pending">Pending</option>
                <option value="provisioned">Provisioned</option>
                <option value="failed">Failed</option>
              </select>
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={working}>
              <Save size={16} aria-hidden="true" />{working ? "Saving…" : "Save changes"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function formatTimestamp(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString();
  } catch {
    return String(timestamp);
  }
}