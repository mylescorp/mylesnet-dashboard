"use client";

import { useMemo, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { useMutation } from "@/app/lib/convex";
import { provisioning, type ProvisioningRequest, type ProvisioningStatus } from "@/shared/convex/provisioning";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { canManagePlatformTenants } from "@/platform/permissions";
import { StatusPill } from "@/shared/components/ui";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

const filters: Array<ProvisioningStatus | "all"> = ["pending", "approved", "deployed", "rejected", "all"];

export function PlatformProvisioning() {
  const { user } = useUserProfile();
  const roles = user?.roles.map(role => role.slug);
  const canManage = canManagePlatformTenants(roles);
  const canDelete = roles?.some(role => ["platform_super_admin", "platform_owner", "platform_admin"].includes(role)) ?? false;
  const { results: rows, status: pageStatus, loadMore } = usePaginatedQuery(provisioning.listRequests, {}, { initialNumItems: 50 });
  const { results: markets, status: marketPageStatus, loadMore: loadMoreMarkets } = usePaginatedQuery(provisioning.listMarkets, canManage ? {} : "skip", { initialNumItems: 50 });
  const decide = useMutation(provisioning.decide);
  const markDeployed = useMutation(provisioning.markDeployed);
  const deleteRequest = useMutation(provisioning.deleteRequest);
  const createRequest = useMutation(provisioning.requestDeviceProvisioning);
  const [filter, setFilter] = useState<ProvisioningStatus | "all">("pending");
  const [creating, setCreating] = useState(false);
  const [working, setWorking] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [marketId, setMarketId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [firmware, setFirmware] = useState("");

  const visible = useMemo(() => rows.filter(row => filter === "all" || row.status === filter), [rows, filter]);
  const counts = useMemo(() => ({
    pending: rows.filter(row => row.status === "pending").length,
    approved: rows.filter(row => row.status === "approved").length,
    deployed: rows.filter(row => row.status === "deployed").length,
  }), [rows]);

  async function run(request: ProvisioningRequest, action: () => Promise<unknown>, success: string) {
    setWorking(request._id); setError(""); setMessage("");
    try { await action(); setMessage(success); }
    catch (caught) { setError(userFacingMessage(caught, "The request could not be updated.")); }
    finally { setWorking(null); }
  }

  async function openRequest(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking("new"); setError(""); setMessage("");
    try {
      await createRequest({ marketId, deviceId: deviceId.trim() || undefined, requestedFirmware: firmware.trim() || undefined });
      setCreating(false); setMarketId(""); setDeviceId(""); setFirmware(""); setMessage("Provisioning request opened for review.");
    } catch (caught) { setError(userFacingMessage(caught, "The request could not be opened.")); }
    finally { setWorking(null); }
  }

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform infrastructure</p><h1 className="page-title">Provisioning queue</h1><p className="page-subtitle">Review cross-tenant device requests. Approval records operator review; it does not claim that a configuration has been pushed to a device.</p></div>{canManage ? <button className="primary-button" type="button" onClick={() => setCreating(true)}>Open request</button> : null}</header>
    <section className="metric-grid"><Metric label="Pending review" value={counts.pending} /><Metric label="Approved" value={counts.approved} /><Metric label="Deployed" value={counts.deployed} /></section>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
    <section className="pf-panel">
      <div className="section-heading"><div><p className="eyebrow">Queue</p><h2>Provisioning requests</h2></div><span className="section-count">{rows.length} loaded</span></div>
      <div className="tab-row" role="tablist" aria-label="Filter provisioning requests">{filters.map(value => <button key={value} type="button" role="tab" aria-selected={filter === value} className={filter === value ? "tab-button active" : "tab-button"} onClick={() => setFilter(value)}>{value === "all" ? "All" : value[0]!.toUpperCase() + value.slice(1)}</button>)}</div>
      {pageStatus === "LoadingFirstPage" ? <p className="pf-muted">Loading requests…</p> : visible.length === 0 ? <p className="pf-muted">No {filter === "all" ? "" : `${filter} `}requests in the loaded records.</p> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Requested</th><th>Organization / market</th><th>Device</th><th>Requested firmware</th><th>Requester</th><th>Status</th><th>Decision</th><th>Actions</th></tr></thead><tbody>{visible.map(row => <tr key={row._id}>
        <td>{new Date(row.requestedAt).toLocaleString()}</td><td>{row.tenantName ? `${row.tenantName} · ` : ""}{row.marketName ?? "Workspace market"}</td>
        <td>{row.deviceId ? <Link href={`/platform/infrastructure/devices/${row.deviceId}`}>View device</Link> : "—"}</td><td>{row.requestedFirmware ?? "Default"}</td><td>{row.requesterName ?? "Workspace user"}</td>
        <td><StatusPill tone={row.status === "deployed" ? "success" : row.status === "pending" ? "warning" : row.status === "rejected" ? "danger" : "neutral"}>{row.status}</StatusPill></td>
        <td>{row.decidedAt ? <>{row.decidedByName ?? "Platform staff"}<small className="table-subtext">{row.decisionNote ?? "No note"}</small></> : "—"}</td>
        <td><div className="cell-actions">{canManage && row.status === "pending" ? <><button className="secondary-button" type="button" disabled={working === row._id} onClick={() => void run(row, () => decide({ requestId: row._id, decision: "approved" }), "Request approved; deployment is still a separate step.")}>Approve</button><button className="secondary-button danger" type="button" disabled={working === row._id} onClick={() => { const note = window.prompt("Reason for rejection"); if (note?.trim()) void run(row, () => decide({ requestId: row._id, decision: "rejected", note }), "Request rejected."); }}>Reject</button></> : null}{canManage && row.status === "approved" ? <button className="secondary-button" type="button" disabled={working === row._id} onClick={() => { if (window.confirm("Record a verified deployment result?")) void run(row, () => markDeployed({ requestId: row._id }), "Deployment result recorded."); }}>Record deployment</button> : null}{canDelete && (row.status === "rejected" || row.status === "deployed") ? <button className="secondary-button danger" type="button" disabled={working === row._id} onClick={() => { if (window.confirm("Delete this terminal request? Its audit record will remain.")) void run(row, () => deleteRequest({ requestId: row._id }), "Request deleted."); }}>Delete</button> : null}</div></td>
      </tr>)}</tbody></table></div>}
      {pageStatus === "CanLoadMore" || pageStatus === "LoadingMore" ? <div className="modal-actions"><button type="button" className="secondary-button" disabled={pageStatus === "LoadingMore"} onClick={() => loadMore(50)}>{pageStatus === "LoadingMore" ? "Loading…" : "Load more requests"}</button></div> : null}
    </section>
    {creating ? <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Open provisioning request"><form className="profile-modal-dialog" onSubmit={openRequest}><header className="profile-modal-header"><div><p className="eyebrow">Device provisioning</p><h2 className="page-title">Open a request</h2></div><button type="button" className="profile-modal-close" onClick={() => setCreating(false)} aria-label="Close">×</button></header><div className="modal-body"><p className="pf-hint">This creates a pending review record only. Device configuration remains a separate approved operation.</p><div className="form-grid"><label className="pf-field pf-field-wide"><span className="pf-label">Organization market</span><select className="pf-input" required value={marketId} onChange={event => setMarketId(event.target.value)}><option value="">Choose a market…</option>{markets.map(market => <option key={market._id} value={market._id}>{market.tenantName ? `${market.tenantName} · ` : ""}{market.name}</option>)}</select>{marketPageStatus === "CanLoadMore" || marketPageStatus === "LoadingMore" ? <button type="button" className="secondary-button" disabled={marketPageStatus === "LoadingMore"} onClick={() => loadMoreMarkets(50)}>{marketPageStatus === "LoadingMore" ? "Loading…" : "Load more markets"}</button> : null}</label><label className="pf-field"><span className="pf-label">Existing device ID (optional)</span><input className="pf-input" value={deviceId} onChange={event => setDeviceId(event.target.value)} /></label><label className="pf-field"><span className="pf-label">Requested firmware (optional)</span><input className="pf-input" value={firmware} onChange={event => setFirmware(event.target.value)} placeholder="e.g. v6.49.10" /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setCreating(false)}>Cancel</button><button className="primary-button" disabled={working === "new" || marketPageStatus === "LoadingFirstPage"}>{working === "new" ? "Opening…" : "Open request"}</button></div></div></form></div> : null}
  </main>;
}

function Metric({ label, value }: { label: string; value: number }) { return <article className="metric-card workspace-card"><p>{label}</p><strong>{value}</strong><small>in loaded queue records</small></article>; }
