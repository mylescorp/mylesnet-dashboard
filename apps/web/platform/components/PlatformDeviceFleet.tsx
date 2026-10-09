"use client";

import { useMemo, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { Cpu, Save } from "lucide-react";
import { useMutation } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { fleet, type FleetRow } from "@/lib/convex/fleet";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

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
    ["platform_super_admin", "platform_owner", "platform_admin", "platform_ops", "ops_manager"].includes(role.slug),
  );

export function PlatformDeviceFleet() {
  const { user } = useUserProfile();
  const editable = canEdit(user?.roles);
  const [showArchived, setShowArchived] = useState(false);
  const [filter, setFilter] = useState<string>("all");
  const { results: fleetRows, status: pageStatus, loadMore } = usePaginatedQuery(
    fleet.list,
    { includeArchived: showArchived, ...(filter === "all" ? {} : { provisioningStatus: filter as FleetRow["provisioningStatus"] & string }) },
    { initialNumItems: 50 },
  );
  const { results: markets, status: marketPageStatus, loadMore: loadMoreMarkets } = usePaginatedQuery(fleet.listMarkets, editable ? {} : "skip", { initialNumItems: 50 });
  const register = useMutation(fleet.register);
  const updateFleet = useMutation(fleet.update);
  const archiveFleet = useMutation(fleet.archive);
  const restoreFleet = useMutation(fleet.restore);
  const [editRow, setEditRow] = useState<FleetRow | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newDevice, setNewDevice] = useState({ marketId: "", name: "", deviceKind: "", macAddress: "", firmwareVersion: "" });
  const [creating, setCreating] = useState(false);

  const visible = useMemo(() => fleetRows.filter((row) => showArchived || !row.deletedAt), [fleetRows, showArchived]);

  const activeRows = fleetRows?.filter((row) => !row.deletedAt);

  async function createDevice(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError(null); setNotice(null); setCreating(true);
    try {
      await register({ ...newDevice, name: newDevice.name.trim(), deviceKind: newDevice.deviceKind.trim(), macAddress: newDevice.macAddress.trim() || undefined, firmwareVersion: newDevice.firmwareVersion.trim() || undefined });
      setNewDevice({ marketId: "", name: "", deviceKind: "", macAddress: "", firmwareVersion: "" });
      setNotice("Device registered as unprovisioned. It is not marked trusted until provisioning review is completed.");
    } catch (caught) { setError(userFacingMessage(caught, "Device could not be registered.")); }
    finally { setCreating(false); }
  }

  async function archiveDevice(row: FleetRow) {
    const reason = window.prompt(`Reason for archiving ${row.name}`);
    if (!reason?.trim()) return;
    try { await archiveFleet({ deviceId: row._id, reason }); setNotice("Device archived."); }
    catch (caught) { setError(userFacingMessage(caught, "Device could not be archived.")); }
  }

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
        <Metric label="Loaded devices" value={activeRows?.length ?? 0} detail="from the cursor-paged fleet" />
        <Metric label="Provisioned" value={activeRows?.filter((r) => r.provisioningStatus === "provisioned").length ?? 0} detail="in loaded rows" />
        <Metric label="Pending" value={activeRows?.filter((r) => r.provisioningStatus === "pending").length ?? 0} detail="in loaded rows" />
        <Metric label="Failed" value={activeRows?.filter((r) => r.provisioningStatus === "failed").length ?? 0} detail="in loaded rows" />
      </section>

      {editable ? <form className="pf-panel" onSubmit={event => void createDevice(event)} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(170px,1fr))", marginBottom: 20 }}>
        <label className="pf-field"><span className="pf-label">Organization market</span><select required className="pf-input" value={newDevice.marketId} onChange={event => setNewDevice(value => ({ ...value, marketId: event.target.value }))}><option value="">Choose a market…</option>{markets.map(market => <option key={market._id} value={market._id}>{market.name}</option>)}</select>{marketPageStatus === "CanLoadMore" || marketPageStatus === "LoadingMore" ? <button type="button" className="secondary-button" disabled={marketPageStatus === "LoadingMore"} onClick={() => loadMoreMarkets(50)}>{marketPageStatus === "LoadingMore" ? "Loading…" : "Load more markets"}</button> : null}</label>
        <label className="pf-field"><span className="pf-label">Device name</span><input required minLength={2} maxLength={120} className="pf-input" value={newDevice.name} onChange={event => setNewDevice(value => ({ ...value, name: event.target.value }))} /></label>
        <label className="pf-field"><span className="pf-label">Model</span><input required minLength={2} maxLength={80} className="pf-input" value={newDevice.deviceKind} onChange={event => setNewDevice(value => ({ ...value, deviceKind: event.target.value }))} /></label>
        <label className="pf-field"><span className="pf-label">MAC address (optional)</span><input className="pf-input" placeholder="00:11:22:33:44:55" value={newDevice.macAddress} onChange={event => setNewDevice(value => ({ ...value, macAddress: event.target.value }))} /></label>
        <label className="pf-field"><span className="pf-label">Firmware (optional)</span><input className="pf-input" maxLength={80} value={newDevice.firmwareVersion} onChange={event => setNewDevice(value => ({ ...value, firmwareVersion: event.target.value }))} /></label>
        <div style={{ display: "flex", alignItems: "end" }}><button className="pf-button" disabled={creating || marketPageStatus === "LoadingFirstPage" || !markets.length}>{creating ? "Registering…" : "Register unprovisioned device"}</button></div>
      </form> : null}

      <section className="section-heading">
        <div><p className="eyebrow">Fleet</p><h2>Device registry</h2></div>
        {editable ? <button className="secondary-button" type="button" aria-pressed={showArchived} onClick={() => setShowArchived(value => !value)}>{showArchived ? "Hide archived" : "Show archived"}</button> : null}
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

      {pageStatus === "LoadingFirstPage" ? (
        <p className="pf-muted">Loading fleet…</p>
        ) : visible.length === 0 ? (
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
              {visible.map((row) => (
                <tr key={row._id}>
                  <td className="pf-cell-main"><Link href={`/platform/infrastructure/devices/${row._id}`}>{row.name}</Link>{row.deletedAt ? <small className="table-subtext">Archived</small> : null}</td>
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
                      {row.deletedAt ? <button type="button" className="secondary-button" onClick={() => void restoreFleet({ deviceId: row._id }).then(() => setNotice("Device restored."), caught => setError(caught instanceof Error ? caught.message : "Device could not be restored."))}>Restore</button> : <><button type="button" className="secondary-button" onClick={() => setEditRow(row)}>Edit</button><button type="button" className="secondary-button danger" onClick={() => void archiveDevice(row)}>Archive</button></>}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {pageStatus !== "Exhausted" ? <div className="section-footer"><button type="button" className="secondary-button" onClick={() => loadMore(50)} disabled={pageStatus === "LoadingMore"}>{pageStatus === "LoadingMore" ? "Loading…" : "Load 50 more devices"}</button></div> : null}

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
              setError(userFacingMessage(caught, "Device could not be updated."));
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
      name: string;
      deviceKind: string;
      firmwareVersion?: string;
      provisioningStatus?: "unprovisioned" | "pending" | "provisioned" | "failed";
    }) => Promise<void>;
  },
) {
  const [firmwareVersion, setFirmwareVersion] = useState(row.firmwareVersion ?? "");
  const [name, setName] = useState(row.name);
  const [deviceKind, setDeviceKind] = useState(row.deviceKind);
  const [provisioningStatus, setProvisioningStatus] = useState(row.provisioningStatus ?? "unprovisioned");
  const [working, setWorking] = useState(false);

  return (
    <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Edit device fleet metadata" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="profile-modal-dialog" onSubmit={async (event) => {
        event.preventDefault();
        setWorking(true);
        await onSave({
          deviceId: row._id,
          name: name.trim(),
          deviceKind: deviceKind.trim(),
          firmwareVersion: firmwareVersion.trim() || undefined,
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
            <label className="pf-field"><span className="pf-label">Device name</span><input required minLength={2} maxLength={120} className="pf-input" value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="pf-field"><span className="pf-label">Model</span><input required minLength={2} maxLength={80} className="pf-input" value={deviceKind} onChange={(event) => setDeviceKind(event.target.value)} /></label>
            <label className="pf-field pf-field-wide">
              <span className="pf-label">Firmware version</span>
              <input className="pf-input" value={firmwareVersion} onChange={(event) => setFirmwareVersion(event.target.value)} placeholder="e.g. v6.49.10" />
            </label>
            <div className="pf-field"><span className="pf-label">Reported uptime</span><p className="pf-static">{row.uptimePercent != null ? `${row.uptimePercent.toFixed(1)}%` : "No telemetry reported"}</p></div>
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
