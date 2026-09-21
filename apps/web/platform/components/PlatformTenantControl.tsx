"use client";

import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Building2, CircleAlert, Link2, PauseCircle, PlayCircle, Plus, UsersRound } from "lucide-react";
import { useAction, useMutation, useQuery } from "@/app/lib/convex";
import { tenantControl, type PlatformTenant, type TenantStatus } from "@/lib/convex/tenantControl";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

const statusTone: Record<TenantStatus, "success" | "warning" | "danger" | "neutral"> = {
  provisioning: "warning", active: "success", trial: "warning", suspended: "danger", cancelled: "neutral",
};

function Status({ status }: { status: TenantStatus }) {
  return <span className={`status-pill status-pill-${statusTone[status]}`}>{status === "provisioning" ? "Preparing" : status}</span>;
}

function safeErrorMessage(error: unknown): string {
  return userFacingMessage(error, "The workspace could not be prepared. Please retry or contact MylesNet support.");
}

export function PlatformTenantControl() {
  const tenants = useQuery(tenantControl.listForPlatform, {});
  const setStatus = useMutation(tenantControl.setStatus);
  const [creating, setCreating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counts = useMemo(() => ({
    total: tenants?.length ?? 0,
    active: tenants?.filter((tenant) => tenant.status === "active" || tenant.status === "trial").length ?? 0,
    preparing: tenants?.filter((tenant) => tenant.status === "provisioning").length ?? 0,
  }), [tenants]);

  const changeStatus = async (tenant: PlatformTenant, status: "active" | "suspended") => {
    setError(null); setNotice(null); setWorkingId(tenant._id);
    try {
      await setStatus({ tenantId: tenant._id, status });
      setNotice(`${tenant.name} is now ${status}.`);
    } catch (caught) {
      setError(safeErrorMessage(caught));
    } finally { setWorkingId(null); }
  };

  return <div className="workspace-page tenant-control-page">
    <header className="page-heading">
      <div><p className="eyebrow">Platform control centre</p><h1 className="page-title">Tenant management</h1><p className="page-subtitle">Create, prepare, and manage customer workspaces without exposing identity-provider setup.</p></div>
      <button type="button" className="primary-button" onClick={() => { setError(null); setNotice(null); setCreating(true); }}><Plus size={17} aria-hidden="true" />Create tenant</button>
    </header>

    <section className="metric-grid" aria-label="Tenant estate summary">
      <Metric icon={<Building2 size={19} />} label="Tenant workspaces" value={counts.total} detail="Registered operators" />
      <Metric icon={<PlayCircle size={19} />} label="Operating" value={counts.active} detail="Trial or active workspaces" tone="success" />
      <Metric icon={<UsersRound size={19} />} label="Preparing" value={counts.preparing} detail="Awaiting administrator sign-in" tone="warning" />
      <Metric icon={<Link2 size={19} />} label="Access model" value="Scoped" detail="Every workspace is isolated" />
    </section>

    {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
    {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

    <section className="pf-panel">
      <div className="section-heading"><div><p className="eyebrow">Tenant estate</p><h2>Registered operators</h2></div><span className="section-count">{counts.total} total</span></div>
      {tenants === undefined ? <p className="pf-muted">Loading tenant inventory…</p> : tenants.length === 0 ? <EmptyTenantState onCreate={() => setCreating(true)} /> : (
        <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Tenant</th><th>Workspace</th><th>Members</th><th>Plan</th><th>Status</th><th /></tr></thead><tbody>
          {tenants.map((tenant) => <tr key={tenant._id}><td><Link href={`/platform/tenants/${tenant._id}`} className="tenant-name-link"><strong>{tenant.name}</strong></Link><small className="table-subtext">{tenant.slug} · {tenant.country}</small></td><td>{tenant.workosOrganizationId ? <span className="tenant-linked"><Link2 size={14} aria-hidden="true" />Ready</span> : <span className="tenant-unlinked"><CircleAlert size={14} aria-hidden="true" />Action needed</span>}</td><td>{tenant.membershipCount}</td><td>{tenant.entitlement ? `${tenant.entitlement.planId} · ${tenant.entitlement.status}` : "Not configured"}</td><td><Status status={tenant.status} /></td><td><div className="cell-actions">{tenant.status === "provisioning" ? <span className="pf-muted">Preparing</span> : tenant.status === "suspended" ? <button type="button" className="secondary-button" disabled={workingId === tenant._id} onClick={() => void changeStatus(tenant, "active")}><PlayCircle size={14} aria-hidden="true" />Activate</button> : <button type="button" className="secondary-button" disabled={workingId === tenant._id || tenant.status === "cancelled"} onClick={() => void changeStatus(tenant, "suspended")}><PauseCircle size={14} aria-hidden="true" />Suspend</button>}</div></td></tr>)}
        </tbody></table></div>
      )}
    </section>
    {creating ? <TenantOnboardingDialog onClose={() => setCreating(false)} onCreated={(message) => { setNotice(message); setCreating(false); }} /> : null}
  </div>;
}

function Metric({ icon, label, value, detail, tone = "accent" }: { icon: ReactNode; label: string; value: number | string; detail: string; tone?: "accent" | "success" | "warning" }) {
  return <article className={`metric-card workspace-card metric-card-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}

function EmptyTenantState({ onCreate }: { onCreate: () => void }) {
  return <div className="tenant-empty-state"><Building2 size={26} aria-hidden="true" /><h3>No tenant is registered yet</h3><p>Create a workspace with the operator’s details and administrator email. MylesNet securely prepares access and sends the administrator an invitation automatically.</p><button type="button" className="primary-button" onClick={onCreate}>Create tenant workspace</button></div>;
}

function TenantOnboardingDialog({ onClose, onCreated }: { onClose: () => void; onCreated: (message: string) => void }) {
  const provisionTenant = useAction(tenantControl.provisionTenant);
  const [form, setForm] = useState({ name: "", slug: "", country: "KE", timezone: "Africa/Nairobi", currency: "KES", ownerEmail: "", ownerName: "" });
  const [working, setWorking] = useState(false); const [error, setError] = useState<string | null>(null);
  const change = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const save = async (event: FormEvent) => {
    event.preventDefault(); setError(null); setWorking(true);
    try {
      if (!/^[a-z0-9-]{3,50}$/.test(form.slug)) throw new Error("Use a lowercase slug (3–50 letters, numbers, or hyphens).");
      await provisionTenant({ ...form, ownerName: form.ownerName.trim() || undefined });
      onCreated(`${form.name} is being prepared. Its administrator will receive a secure MylesNet invitation.`);
    } catch (caught) { setError(safeErrorMessage(caught)); } finally { setWorking(false); }
  };
  return <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Create tenant workspace" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="profile-modal-dialog" onSubmit={save}><header className="profile-modal-header"><div><p className="eyebrow">Tenant onboarding</p><h2 className="page-title">Create a tenant workspace</h2></div><button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header><div className="modal-body"><p className="pf-hint">MylesNet creates the workspace, configures secure access, and sends the administrator invitation in the background. No technical identity setup is needed here.</p>{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}<div className="form-grid"><label className="pf-field"><span className="pf-label">Tenant name</span><input className="pf-input" required value={form.name} onChange={(event) => change("name", event.target.value)} /></label><label className="pf-field"><span className="pf-label">Workspace address</span><input className="pf-input" required value={form.slug} onChange={(event) => change("slug", event.target.value.toLowerCase())} placeholder="example-isp" /></label><label className="pf-field"><span className="pf-label">Administrator email</span><input className="pf-input" type="email" required value={form.ownerEmail} onChange={(event) => change("ownerEmail", event.target.value)} /></label><label className="pf-field"><span className="pf-label">Administrator name <small>(optional)</small></span><input className="pf-input" value={form.ownerName} onChange={(event) => change("ownerName", event.target.value)} /></label><label className="pf-field"><span className="pf-label">Country</span><input className="pf-input" required maxLength={2} value={form.country} onChange={(event) => change("country", event.target.value.toUpperCase())} /></label><label className="pf-field"><span className="pf-label">Currency</span><input className="pf-input" required maxLength={3} value={form.currency} onChange={(event) => change("currency", event.target.value.toUpperCase())} /></label><label className="pf-field"><span className="pf-label">Timezone</span><input className="pf-input" required value={form.timezone} onChange={(event) => change("timezone", event.target.value)} /></label></div></div><footer className="profile-modal-actions"><button type="button" className="secondary-button" onClick={onClose} disabled={working}>Cancel</button><button type="submit" className="primary-button" disabled={working}>{working ? "Preparing workspace…" : "Create workspace"}</button></footer></form></div>;
}
