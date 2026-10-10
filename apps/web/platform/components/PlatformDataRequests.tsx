"use client";

import { useState, type FormEvent } from "react";
import { usePaginatedQuery } from "convex/react";
import { useMutation } from "@/app/lib/convex";
import { tenantControl } from "@/lib/convex/tenantControl";
import { platformDataRequests, type DataRequestStatus, type DataRequestType, type PlatformDataRequest } from "@/shared/convex/platformDataRequests";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import { hasAnyRole } from "@/shared/auth/rbac";

const isSuperAdmin = (roles: { slug: string }[] | undefined) => hasAnyRole(roles?.map((role) => role.slug) ?? [], ["platform_super_admin", "platform_owner", "platform_admin"]);
const statuses: DataRequestStatus[] = ["received", "under_review", "completed", "rejected"];

export function PlatformDataRequests() {
  const { user } = useUserProfile();
  const canManage = isSuperAdmin(user?.roles);
  const { results: tenants, status: tenantPageStatus, loadMore: loadMoreTenants } = usePaginatedQuery(tenantControl.listPlatformTenantTargetsPage, {}, { initialNumItems: 20 });
  const { results, status: pageStatus, loadMore } = usePaginatedQuery(platformDataRequests.list, { includeDeleted: canManage }, { initialNumItems: 20 });
  const create = useMutation(platformDataRequests.create); const update = useMutation(platformDataRequests.update);
  const remove = useMutation(platformDataRequests.remove); const restore = useMutation(platformDataRequests.restore);
  const [type, setType] = useState<DataRequestType>("export"); const [tenantId, setTenantId] = useState("");
  const [name, setName] = useState(""); const [email, setEmail] = useState(""); const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState(""); const [message, setMessage] = useState("");

  async function intake(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try { await create({ requestType: type, tenantId: tenantId || undefined, requesterName: name, requesterEmail: email, requestNotes: notes }); setName(""); setEmail(""); setNotes(""); setTenantId(""); setMessage("Request intake recorded."); }
    catch (cause) { setError(userFacingMessage(cause, "The request could not be recorded.")); }
    finally { setBusy(false); }
  }
  async function changeStatus(row: PlatformDataRequest, status: DataRequestStatus) {
    const adminNotes = window.prompt("Internal review notes (optional):", row.adminNotes ?? ""); if (adminNotes === null) return;
    setBusy(true); setError(""); setMessage("");
    try { await update({ requestId: row._id, status, adminNotes }); setMessage("Request review updated."); }
    catch (cause) { setError(userFacingMessage(cause, "The request could not be updated.")); }
    finally { setBusy(false); }
  }
  async function archive(row: PlatformDataRequest) {
    const reason = window.prompt("Reason for archiving this intake record:"); if (!reason) return;
    setBusy(true); setError(""); setMessage("");
    try { await remove({ requestId: row._id, reason }); setMessage("Request record archived."); }
    catch (cause) { setError(userFacingMessage(cause, "The request could not be archived.")); }
    finally { setBusy(false); }
  }

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform security</p><h1 className="page-title">Data requests</h1><p className="page-subtitle">Record and review tenant export or deletion requests.</p></div><StatusPill tone="warning">Intake only</StatusPill></header>
    <p className="pf-hint">This queue tracks requests only. It does not export data or delete tenant records. Fulfillment requires a separate verified workflow.</p>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Request intake</p><h2>Record a request</h2></div></div>
      <form className="form-grid" onSubmit={event => void intake(event)}>
        <label className="pf-field"><span className="pf-label">Request type</span><select className="pf-input" value={type} onChange={event => setType(event.target.value as DataRequestType)}><option value="export">Data export</option><option value="deletion">Data deletion</option></select></label>
        <label className="pf-field"><span className="pf-label">Tenant</span><select className="pf-input" value={tenantId} onChange={event => setTenantId(event.target.value)}><option value="">Not specified</option>{tenants.map(tenant => <option key={tenant._id} value={tenant._id}>{tenant.name}</option>)}</select>{tenantPageStatus === "CanLoadMore" ? <button className="secondary-button" type="button" onClick={() => loadMoreTenants(20)}>Load more tenants</button> : null}</label>
        <label className="pf-field"><span className="pf-label">Requester name</span><input className="pf-input" required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
        <label className="pf-field"><span className="pf-label">Requester email</span><input className="pf-input" type="email" required maxLength={254} value={email} onChange={event => setEmail(event.target.value)} /></label>
        <label className="pf-field" style={{ gridColumn: "1 / -1" }}><span className="pf-label">Request details</span><textarea className="pf-input" required maxLength={3000} rows={4} value={notes} onChange={event => setNotes(event.target.value)} /></label>
        <div><button className="primary-button" disabled={busy || tenantPageStatus === "LoadingFirstPage"}>{busy ? "Saving…" : "Record request"}</button></div>
      </form>
    </section>
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Request tracking</p><h2>Requests</h2></div><span className="section-count">{results.length} loaded</span></div>
      {pageStatus === "LoadingFirstPage" ? <p className="pf-muted">Loading requests…</p> : results.length === 0 ? <EmptyState title="No requests recorded" body="New data export or deletion requests will appear here." /> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Request</th><th>Tenant</th><th>Requester</th><th>Received</th><th>Status</th><th>Review</th></tr></thead><tbody>{results.map(row => <tr key={row._id}><td><strong>{row.requestType === "export" ? "Data export" : "Data deletion"}</strong><small className="table-subtext">{row.requestNotes}</small></td><td>{row.tenantName ?? "Unspecified"}</td><td>{row.requesterName}<small className="table-subtext">{row.requesterEmail}</small></td><td>{new Date(row.createdAt).toLocaleDateString("en-KE")}</td><td>{row.deletedAt ? <StatusPill tone="neutral">Archived</StatusPill> : <StatusPill tone={row.status === "completed" ? "success" : row.status === "rejected" ? "danger" : "warning"}>{row.status.replace("_", " ")}</StatusPill>}</td><td>{canManage ? row.deletedAt ? <button className="secondary-button" disabled={busy} onClick={() => void restore({ requestId: row._id }).catch(cause => setError(userFacingMessage(cause, "Restore failed.")))}>Restore</button> : <div className="cell-actions"><select aria-label={`Update status for ${row.requesterName}`} className="pf-input" value={row.status} disabled={busy} onChange={event => void changeStatus(row, event.target.value as DataRequestStatus)}>{statuses.map(value => <option key={value} value={value}>{value.replace("_", " ")}</option>)}</select><button className="secondary-button" disabled={busy} onClick={() => void archive(row)}>Archive</button></div> : row.adminNotes ? <span className="pf-muted">Reviewed</span> : <span className="pf-muted">—</span>}</td></tr>)}</tbody></table></div>}
      {pageStatus === "CanLoadMore" ? <button className="secondary-button" disabled={busy} onClick={() => loadMore(20)}>Load more</button> : null}
    </section>
  </main>;
}
