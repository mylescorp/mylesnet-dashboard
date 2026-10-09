"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useMutation } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import { platformPartners, type PartnerType } from "@/shared/convex/platformPartners";

const EDIT_ROLES = ["platform_super_admin", "platform_owner", "platform_admin"];
const READ_ROLES = [...EDIT_ROLES, "platform_ops", "platform_finance", "platform_support", "platform_readonly"];

export function PlatformPartnerRegistry({ type }: { type: PartnerType }) {
  const { user } = useUserProfile();
  const roles = user?.roles.map(role => role.slug) ?? [];
  const canRead = roles.some(role => READ_ROLES.includes(role));
  const canEdit = roles.some(role => EDIT_ROLES.includes(role));
  const heading = type === "agency" ? "Agencies" : "Resellers";
  const singular = type === "agency" ? "Agency" : "Reseller";
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const { results, status, loadMore } = usePaginatedQuery(platformPartners.list, canRead ? { type } : "skip", { initialNumItems: 20 });
  const { results: tenantOptions, status: tenantStatus, loadMore: loadMoreTenants } = usePaginatedQuery(platformPartners.tenantOptions, canEdit ? {} : "skip", { initialNumItems: 50 });
  const create = useMutation(platformPartners.create);
  const update = useMutation(platformPartners.update);
  const archive = useMutation(platformPartners.archive);
  const suspend = useMutation(platformPartners.suspend);
  const restore = useMutation(platformPartners.restore);
  const [parentId, setParentId] = useState("");
  const [childId, setChildId] = useState("");
  const [saving, setSaving] = useState(false);
  const act = async (operation: () => Promise<unknown>, success: string) => {
    setSaving(true); setError(null); setNotice(null);
    try { await operation(); setNotice(success); }
    catch (cause) { setError(userFacingMessage(cause, `${heading} could not be updated.`)); }
    finally { setSaving(false); }
  };
  if (!canRead) return <main className="workspace-page"><h1 className="page-title">Access restricted</h1><p className="page-subtitle">Your platform role cannot view this registry.</p></main>;

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform partner oversight</p><h1 className="page-title">{heading}</h1><p className="page-subtitle">Explicit operator-to-{type} tenant relationships. Field agents are managed separately.</p></div></header>
    {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}{notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
    {canEdit ? <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Register relationship</p><h2>Link existing organizations</h2></div></div><p className="pf-hint">This records a scoped relationship between existing tenants. It does not create a tenant, invite users, or transfer data.</p><div className="form-grid"><label className="pf-field"><span className="pf-label">Parent operator</span><select className="pf-input" value={parentId} onChange={event => setParentId(event.target.value)}><option value="">Choose operator</option>{tenantOptions.map(option => <option key={option.id} value={option.id}>{option.name} · {option.slug}</option>)}</select></label><label className="pf-field"><span className="pf-label">{type === "agency" ? "Agency organization" : "Reseller organization"}</span><select className="pf-input" value={childId} onChange={event => setChildId(event.target.value)}><option value="">Choose organization</option>{tenantOptions.map(option => <option key={option.id} value={option.id}>{option.name} · {option.slug}</option>)}</select></label></div><div className="modal-actions"><button type="button" className="primary-button" disabled={saving || !parentId || !childId} onClick={() => void act(async () => { await create({ type, parentTenantId: parentId, childTenantId: childId }); setParentId(""); setChildId(""); }, `${singular} relationship created.`)}>Create relationship</button>{tenantStatus === "CanLoadMore" || tenantStatus === "LoadingMore" ? <button type="button" className="secondary-button" onClick={() => loadMoreTenants(50)} disabled={tenantStatus === "LoadingMore"}>Load more organizations</button> : null}</div></section> : null}
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Relationship inventory</p><h2>Registered {heading.toLowerCase()}</h2></div><span className="section-count">{results.length} loaded</span></div>
      {status === "LoadingFirstPage" ? <p className="pf-muted">Loading registry…</p> : results.length === 0 ? <p className="pf-muted">No {heading.toLowerCase()} relationships are registered.</p> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>{singular}</th><th>Parent operator</th><th>Tenant status</th><th>Relationship</th><th>Created</th>{canEdit ? <th>Actions</th> : null}</tr></thead><tbody>{results.map(row => <tr key={row.id}><td>{row.partner ? <><strong>{row.partner.name}</strong><small className="table-subtext">{row.partner.slug}</small></> : <span className="pf-muted">Linked tenant unavailable</span>}</td><td>{row.parent ? <><strong>{row.parent.name}</strong><small className="table-subtext">{row.parent.slug}</small></> : <span className="pf-muted">Linked tenant unavailable</span>}</td><td>{row.partner?.status ?? "Unknown"}</td><td><span className={`status-pill status-pill-${row.status === "active" ? "success" : "danger"}`}>{row.archived ? "archived" : row.status}</span></td><td>{new Date(row.createdAt).toLocaleDateString("en-KE")}</td>{canEdit ? <td><div className="cell-actions">{!row.archived ? <>{row.status === "active" ? <button type="button" className="secondary-button" disabled={saving} onClick={() => { const reason = window.prompt("Suspension reason (8–500 characters)"); if (reason !== null) void act(async () => { const result = await suspend({ id: row.id, reason }); setNotice(`Relationship suspended; ${result.affectedRelationships} linked relationship(s) affected.`); }, "Relationship suspended."); }}>Suspend</button> : <button type="button" className="secondary-button" disabled={saving} onClick={() => { const reason = window.prompt("Restoration reason (8–500 characters)"); if (reason !== null) void act(async () => { const result = await restore({ id: row.id, reason }); setNotice(`Relationship restored; ${result.affectedRelationships} linked relationship(s) affected.`); }, "Relationship restored."); }}>Restore</button>}<label className="pf-field"><span className="pf-label">Parent</span><select className="pf-input" value={row.parent?.id ?? ""} disabled={saving} onChange={event => void act(() => update({ id: row.id, parentTenantId: event.target.value }), "Parent operator updated.")}><option value={row.parent?.id}>{row.parent?.name ?? "Unavailable"}</option>{tenantOptions.filter(option => option.id !== row.partner?.id && option.id !== row.parent?.id).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><label className="pf-field"><span className="pf-label">Partner organization</span><select className="pf-input" value={row.partner?.id ?? ""} disabled={saving} onChange={event => void act(() => update({ id: row.id, childTenantId: event.target.value }), "Partner organization updated.")}><option value={row.partner?.id}>{row.partner?.name ?? "Unavailable"}</option>{tenantOptions.filter(option => option.id !== row.parent?.id && option.id !== row.partner?.id).map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label><button type="button" className="secondary-button" disabled={saving} onClick={() => { if (window.confirm(`Archive this ${type} relationship? Tenant records will remain intact.`)) void act(() => archive({ id: row.id }), "Relationship archived."); }}>Archive</button></> : <span className="pf-muted">Archived</span>}</div></td> : null}</tr>)}</tbody></table></div>}
      {status === "CanLoadMore" || status === "LoadingMore" ? <div className="modal-actions"><button type="button" className="secondary-button" disabled={status === "LoadingMore"} onClick={() => loadMore(20)}>{status === "LoadingMore" ? "Loading…" : `Load more ${heading.toLowerCase()}`}</button></div> : null}
    </section>
  </main>;
}
