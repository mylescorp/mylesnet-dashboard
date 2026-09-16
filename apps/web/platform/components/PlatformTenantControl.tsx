"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CircleAlert, Link2, PauseCircle, PlayCircle, Plus, UsersRound } from "lucide-react";
import { useAction, useMutation, useQuery } from "@/app/lib/convex";
import { tenantControl, type PlatformTenant, type TenantStatus } from "@/lib/convex/tenantControl";

const statusTone: Record<TenantStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success", trial: "warning", suspended: "danger", cancelled: "neutral",
};

function Status({ status }: { status: TenantStatus }) {
  return <span className={`status-pill status-pill-${statusTone[status]}`}>{status}</span>;
}

export function PlatformTenantControl() {
  const tenants = useQuery(tenantControl.listForPlatform, {});
  const setStatus = useMutation(tenantControl.setStatus);
  const registerTenant = useAction(tenantControl.registerExistingOrganization);
  const [creating, setCreating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => ({
    total: tenants?.length ?? 0,
    active: tenants?.filter((tenant) => tenant.status === "active").length ?? 0,
    needsIdentity: tenants?.filter((tenant) => !tenant.workosOrganizationId).length ?? 0,
  }), [tenants]);

  const changeStatus = async (tenant: PlatformTenant, status: "active" | "suspended") => {
    setError(null); setNotice(null); setWorkingId(tenant._id);
    try {
      await setStatus({ tenantId: tenant._id, status });
      setNotice(`${tenant.name} is now ${status}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tenant status could not be changed.");
    } finally { setWorkingId(null); }
  };

  return (
    <div className="workspace-page tenant-control-page">
      <header className="page-heading">
        <div><p className="eyebrow">Platform control plane</p><h1 className="page-title">Tenant management</h1><p className="page-subtitle">Register verified tenant organizations, monitor identity readiness, and manage lifecycle state without deleting customer records.</p></div>
        <button type="button" className="primary-button" onClick={() => { setError(null); setNotice(null); setCreating(true); }}><Plus size={17} aria-hidden="true" />Register tenant</button>
      </header>

      <section className="metric-grid" aria-label="Tenant estate summary">
        <Metric icon={<Building2 size={19} />} label="Registered tenants" value={counts.total} detail="Convex tenant records" />
        <Metric icon={<PlayCircle size={19} />} label="Active tenants" value={counts.active} detail="Enabled for tenant operations" tone="success" />
        <Metric icon={<Link2 size={19} />} label="Identity mapping" value={counts.needsIdentity} detail="Need a WorkOS organization link" tone={counts.needsIdentity ? "warning" : "success"} />
        <Metric icon={<UsersRound size={19} />} label="Workspace rule" value="Scoped" detail="Tenant comes from WorkOS membership" />
      </section>

      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Tenant estate</p><h2>Registered operators</h2></div><span className="section-count">{counts.total} total</span></div>
        {tenants === undefined ? <p className="pf-muted">Loading tenant inventory…</p> : tenants.length === 0 ? <EmptyTenantState onRegister={() => setCreating(true)} /> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Tenant</th><th>Identity</th><th>Members</th><th>Plan</th><th>Status</th><th /></tr></thead><tbody>
            {tenants.map((tenant) => <tr key={tenant._id}><td><Link href={`/platform/tenants/${tenant._id}`} className="tenant-name-link"><strong>{tenant.name}</strong></Link><small className="table-subtext">{tenant.slug} · {tenant.country}</small></td><td>{tenant.workosOrganizationId ? <span className="tenant-linked"><Link2 size={14} aria-hidden="true" />Connected</span> : <span className="tenant-unlinked"><CircleAlert size={14} aria-hidden="true" />Missing mapping</span>}</td><td>{tenant.membershipCount}</td><td>{tenant.entitlement ? `${tenant.entitlement.planId} · ${tenant.entitlement.status}` : "Not configured"}</td><td><Status status={tenant.status} /></td><td><div className="cell-actions">{tenant.status === "suspended" ? <button type="button" className="secondary-button" disabled={workingId === tenant._id} onClick={() => void changeStatus(tenant, "active")}><PlayCircle size={14} aria-hidden="true" />Activate</button> : <button type="button" className="secondary-button" disabled={workingId === tenant._id || tenant.status === "cancelled"} onClick={() => void changeStatus(tenant, "suspended")}><PauseCircle size={14} aria-hidden="true" />Suspend</button>}</div></td></tr>)}
          </tbody></table></div>
        )}
      </section>
      {creating ? <TenantRegistrationDialog onClose={() => setCreating(false)} onRegistered={(message) => { setNotice(message); setCreating(false); }} registerTenant={registerTenant} /> : null}
    </div>
  );
}

function Metric({ icon, label, value, detail, tone = "accent" }: { icon: React.ReactNode; label: string; value: number | string; detail: string; tone?: "accent" | "success" | "warning" }) { return <article className={`metric-card workspace-card metric-card-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>; }
function EmptyTenantState({ onRegister }: { onRegister: () => void }) { return <div className="tenant-empty-state"><Building2 size={26} aria-hidden="true" /><h3>No tenant is registered yet</h3><p>Create the WorkOS tenant organization and its owner membership first, then register the verified pair here. This panel will never create a speculative tenant.</p><button type="button" className="primary-button" onClick={onRegister}>Register verified tenant</button></div>; }

function TenantRegistrationDialog({ onClose, onRegistered, registerTenant }: { onClose: () => void; onRegistered: (message: string) => void; registerTenant: ReturnType<typeof useAction<typeof tenantControl.registerExistingOrganization>> }) {
  const [form, setForm] = useState({ name: "", slug: "", country: "KE", timezone: "Africa/Nairobi", currency: "KES", workosOrganizationId: "", ownerWorkosUserId: "" });
  const [working, setWorking] = useState(false); const [error, setError] = useState<string | null>(null);
  const change = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const save = async (event: React.FormEvent) => { event.preventDefault(); setError(null); setWorking(true); try { if (!/^[a-z0-9-]{3,50}$/.test(form.slug)) throw new Error("Use a lowercase slug (3–50 letters, numbers, or hyphens)."); await registerTenant(form); onRegistered(`${form.name} was registered as a trial tenant after WorkOS owner verification.`); } catch (caught) { setError(caught instanceof Error ? caught.message : "Tenant registration failed."); } finally { setWorking(false); } };
  return <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Register verified tenant" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="profile-modal-dialog" onSubmit={save}><header className="profile-modal-header"><div><p className="eyebrow">Tenant onboarding</p><h2 className="page-title">Register a verified tenant</h2></div><button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header><div className="modal-body"><p className="pf-hint">This does not create a WorkOS organization. It verifies an existing active owner membership first, then records the tenant and local owner membership.</p>{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}<div className="form-grid"><label className="pf-field"><span className="pf-label">Tenant name</span><input className="pf-input" required value={form.name} onChange={(event) => change("name", event.target.value)} /></label><label className="pf-field"><span className="pf-label">Slug</span><input className="pf-input" required value={form.slug} onChange={(event) => change("slug", event.target.value.toLowerCase())} placeholder="example-isp" /></label><label className="pf-field"><span className="pf-label">WorkOS organization ID</span><input className="pf-input" required value={form.workosOrganizationId} onChange={(event) => change("workosOrganizationId", event.target.value)} /></label><label className="pf-field"><span className="pf-label">Confirmed owner WorkOS user ID</span><input className="pf-input" required value={form.ownerWorkosUserId} onChange={(event) => change("ownerWorkosUserId", event.target.value)} /></label><label className="pf-field"><span className="pf-label">Country</span><input className="pf-input" required maxLength={2} value={form.country} onChange={(event) => change("country", event.target.value.toUpperCase())} /></label><label className="pf-field"><span className="pf-label">Currency</span><input className="pf-input" required maxLength={3} value={form.currency} onChange={(event) => change("currency", event.target.value.toUpperCase())} /></label><label className="pf-field"><span className="pf-label">Timezone</span><input className="pf-input" required value={form.timezone} onChange={(event) => change("timezone", event.target.value)} /></label></div></div><footer className="profile-modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={working}>Cancel</button><button type="submit" className="primary-button" disabled={working}>{working ? "Verifying owner…" : "Verify and register"}</button></footer></form></div>;
}
