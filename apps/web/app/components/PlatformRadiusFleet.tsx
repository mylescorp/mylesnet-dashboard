"use client";

import { useMemo, useState } from "react";
import { Server, Save } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "./UserProfileContext";
import { radiusFleet, type RadiusServerRow } from "@/lib/convex/radiusFleet";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "provisioning", label: "Provisioning" },
  { key: "failed", label: "Failed" },
  { key: "maintenance", label: "Maintenance" },
  { key: "decommissioned", label: "Decommissioned" },
] as const;

type StatusTone = "neutral" | "warning" | "success" | "danger" | "muted";
const STATUS_TONE: Record<string, StatusTone> = {
  active: "success",
  provisioning: "warning",
  failed: "danger",
  maintenance: "neutral",
  decommissioned: "muted",
};

const HEALTH_TONE: Record<string, StatusTone> = {
  healthy: "success",
  degraded: "warning",
  down: "danger",
  unknown: "muted",
};

const canEdit = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) =>
    ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug),
  );

const canDelete = (roles: { slug: string }[] | undefined) =>
  roles !== undefined &&
  roles.some((role) => role.slug === "platform_owner");

export function PlatformRadiusFleet() {
  const { user } = useUserProfile();
  const serverRows = useQuery(radiusFleet.list, {});
  const updateServer = useMutation(radiusFleet.update);
  const deleteServer = useMutation(radiusFleet.delete);
  const [filter, setFilter] = useState<string>("all");
  const [editRow, setEditRow] = useState<RadiusServerRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = canEdit(user?.roles);
  const deletable = canDelete(user?.roles);

  const visible = useMemo(() => {
    if (!serverRows) return undefined;
    if (filter === "all") return serverRows;
    return serverRows.filter((row) => row.status === filter);
  }, [serverRows, filter]);

  const metrics = useMemo(
    () => ({
      total: serverRows?.length ?? 0,
      active: serverRows?.filter((r) => r.status === "active").length ?? 0,
      degraded:
        serverRows?.filter(
          (r) => r.healthStatus === "degraded" || r.healthStatus === "down",
        ).length ?? 0,
      provisioning:
        serverRows?.filter((r) => r.status === "provisioning").length ?? 0,
    }),
    [serverRows],
  );

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">RADIUS server fleet</h1>
          <p className="page-subtitle">
            Shared FreeRADIUS nodes across every region — hostname, protocol,
            status, health, and certificate posture.
          </p>
        </div>
      </header>

      {error ? (
        <p className="platform-claim-message" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="platform-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="metric-grid" aria-label="RADIUS fleet summary">
        <Metric
          label="Servers"
          value={metrics.total}
          detail="registered across all regions"
        />
        <Metric
          label="Active"
          value={metrics.active}
          detail="live in the managed estate"
        />
        <Metric
          label="Degraded / Down"
          value={metrics.degraded}
          detail="needs attention"
        />
        <Metric
          label="Provisioning"
          value={metrics.provisioning}
          detail="awaiting setup"
        />
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Fleet</p>
          <h2>RADIUS nodes</h2>
        </div>
        <div className="tab-row" role="tablist" aria-label="Filter servers">
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

      {serverRows === undefined ? (
        <p className="pf-muted">Loading RADIUS fleet…</p>
      ) : visible?.length === 0 ? (
        <div className="tenant-empty-state">
          <Server size={26} aria-hidden="true" />
          <h3>
            No {filter === "all" ? "" : `${filter} `}
            RADIUS servers
          </h3>
          <p>
            RADIUS servers are registered through the platform provisioning
            flow or manually by a super admin.
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Hostname / IP</th>
                <th>Port</th>
                <th>Protocol</th>
                <th>Region</th>
                <th>Status</th>
                <th>Health</th>
                <th>Last check</th>
                {editable ? <th className="pf-action-col">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible?.map((row) => (
                <tr key={row._id}>
                  <td className="pf-cell-main">{row.name}</td>
                  <td>{row.hostname}</td>
                  <td>{row.port}</td>
                  <td>
                    <span className="pf-badge pf-badge-neutral">
                      {row.protocol}
                    </span>
                  </td>
                  <td>{row.region ?? "—"}</td>
                  <td>
                    <span
                      className={`pf-badge pf-badge-${STATUS_TONE[row.status]}`}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>
                    <span
                      className={`pf-badge pf-badge-${HEALTH_TONE[row.healthStatus]}`}
                    >
                      {row.healthStatus}
                    </span>
                  </td>
                  <td>
                    {row.lastHealthCheckAt
                      ? formatTimestamp(row.lastHealthCheckAt)
                      : "Never"}
                  </td>
                  {editable ? (
                    <td className="pf-action-col">
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setEditRow(row)}
                      >
                        Edit
                      </button>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow && editable ? (
        <ServerEditor
          row={editRow}
          deletable={deletable}
          onClose={() => setEditRow(null)}
          onSave={async (input) => {
            setError(null);
            setNotice(null);
            try {
              await updateServer(input);
              setEditRow(null);
              setNotice("RADIUS server updated.");
            } catch (caught) {
              setError(
                caught instanceof Error ? caught.message : "Update failed.",
              );
            }
          }}
          onDelete={async (reason) => {
            setError(null);
            setNotice(null);
            try {
              await deleteServer({ serverId: editRow._id, deleteReason: reason });
              setEditRow(null);
              setNotice("RADIUS server decommissioned.");
            } catch (caught) {
              setError(
                caught instanceof Error ? caught.message : "Delete failed.",
              );
            }
          }}
        />
      ) : null}
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

function ServerEditor({
  row,
  deletable,
  onClose,
  onSave,
  onDelete,
}: {
  row: RadiusServerRow;
  deletable: boolean;
  onClose: () => void;
  onSave: (input: {
    serverId: string;
    name?: string;
    hostname?: string;
    port?: number;
    protocol?: "radsec" | "udp";
    status?: "active" | "provisioning" | "failed" | "maintenance" | "decommissioned";
    healthStatus?: "healthy" | "degraded" | "down" | "unknown";
    region?: string;
    notes?: string;
  }) => Promise<void>;
  onDelete: (reason: string) => Promise<void>;
}) {
  const [name, setName] = useState(row.name);
  const [hostname, setHostname] = useState(row.hostname);
  const [port, setPort] = useState(row.port);
  const [protocol, setProtocol] = useState<"radsec" | "udp">(row.protocol);
  const [status, setStatus] = useState(row.status);
  const [healthStatus, setHealthStatus] = useState(row.healthStatus);
  const [region, setRegion] = useState(row.region ?? "");
  const [working, setWorking] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  return (
    <div
      className="profile-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Edit RADIUS server"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <form
        className="profile-modal-dialog"
        onSubmit={async (event) => {
          event.preventDefault();
          setWorking(true);
          await onSave({
            serverId: row._id,
            name: name.trim() || undefined,
            hostname: hostname.trim() || undefined,
            port,
            protocol,
            status,
            healthStatus,
            region: region.trim() || undefined,
          });
          setWorking(false);
        }}
      >
        <header className="profile-modal-header">
          <div>
            <p className="eyebrow">RADIUS fleet</p>
            <h2 className="page-title">{row.name}</h2>
          </div>
          <button
            type="button"
            className="profile-modal-close"
            onClick={onClose}
            aria-label="Close dialog"
          >
            ×
          </button>
        </header>
        <div className="modal-body">
          <div className="form-grid">
            <label className="pf-field pf-field-wide">
              <span className="pf-label">Name</span>
              <input
                className="pf-input"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. RADIUS Node 1 — AWS Cape Town"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Hostname / IP</span>
              <input
                className="pf-input"
                value={hostname}
                onChange={(event) => setHostname(event.target.value)}
                placeholder="e.g. 10.0.1.50"
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Port</span>
              <input
                className="pf-input"
                type="number"
                min={1}
                max={65535}
                value={port}
                onChange={(event) => setPort(Number(event.target.value))}
              />
            </label>
            <label className="pf-field">
              <span className="pf-label">Protocol</span>
              <select
                className="pf-input"
                value={protocol}
                onChange={(event) =>
                  setProtocol(event.target.value as typeof protocol)
                }
              >
                <option value="radsec">RadSec (TLS)</option>
                <option value="udp">UDP (shared secret)</option>
              </select>
            </label>
            <label className="pf-field">
              <span className="pf-label">Status</span>
              <select
                className="pf-input"
                value={status}
                onChange={(event) =>
                  setStatus(event.target.value as typeof status)
                }
              >
                <option value="active">Active</option>
                <option value="provisioning">Provisioning</option>
                <option value="failed">Failed</option>
                <option value="maintenance">Maintenance</option>
                <option value="decommissioned">Decommissioned</option>
              </select>
            </label>
            <label className="pf-field">
              <span className="pf-label">Health</span>
              <select
                className="pf-input"
                value={healthStatus}
                onChange={(event) =>
                  setHealthStatus(event.target.value as typeof healthStatus)
                }
              >
                <option value="healthy">Healthy</option>
                <option value="degraded">Degraded</option>
                <option value="down">Down</option>
                <option value="unknown">Unknown</option>
              </select>
            </label>
            <label className="pf-field pf-field-wide">
              <span className="pf-label">Region</span>
              <input
                className="pf-input"
                value={region}
                onChange={(event) => setRegion(event.target.value)}
                placeholder="e.g. aws-cape-town"
              />
            </label>
          </div>
          <div className="modal-actions">
            {deletable ? (
              confirmDelete ? (
                <>
                  <input
                    className="pf-input"
                    value={deleteReason}
                    onChange={(event) => setDeleteReason(event.target.value)}
                    placeholder="Decommission reason"
                    aria-label="Decommission reason"
                  />
                  <button
                    type="button"
                    className="danger-button"
                    disabled={working || !deleteReason.trim()}
                    onClick={async () => {
                      setWorking(true);
                      await onDelete(deleteReason.trim());
                      setWorking(false);
                    }}
                  >
                    Confirm
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="danger-button"
                  onClick={() => setConfirmDelete(true)}
                >
                  Decommission
                </button>
              )
            ) : null}
            <span className="action-spacer" />
            <button
              type="button"
              className="secondary-button"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="primary-button"
              disabled={working}
            >
              <Save size={16} aria-hidden="true" />
              {working ? "Saving…" : "Save changes"}
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
