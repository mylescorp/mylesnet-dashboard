"use client";

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { tenantControl, type PlatformTenant, type EntitlementStatus } from "@/lib/convex/tenantControl";
import { useUserProfile } from "./UserProfileContext";
import { StatusPill, Field, TextInput } from "./ui";

const entitlementTone: Record<EntitlementStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  trial: "warning",
  expired: "danger",
  suspended: "danger",
};

export function PlatformSubscriptions() {
  const { user } = useUserProfile();
  const tenants = useQuery(tenantControl.listForPlatform, {});
  const setEntitlement = useMutation(tenantControl.setEntitlement);
  const [editingTenant, setEditingTenant] = useState<PlatformTenant | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.roles.some((role) => ["platform_owner", "platform_admin"].includes(role.slug));

  return (
    <div className="workspace-page tenant-control-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">Set and adjust plan entitlements per tenant. This controls product access, not payments or billing, which remain outside Convex.</p>
        </div>
      </header>

      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Entitlements</p><h2>Tenant plans</h2></div><span className="section-count">{tenants?.length ?? 0} tenants</span></div>
        {tenants === undefined ? <p className="pf-muted">Loading subscriptions…</p> : tenants.length === 0 ? <p className="pf-muted">No tenants have been registered yet.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Tenant</th><th>Slug</th><th>Plan</th><th>Entitlement status</th><th /></tr></thead><tbody>
            {tenants.map((tenant: PlatformTenant) => (
              <tr key={tenant._id}>
                <td><strong>{tenant.name}</strong><small className="table-subtext">{tenant.country}</small></td>
                <td><code>{tenant.slug}</code></td>
                <td>{tenant.entitlement ? tenant.entitlement.planId : "Not configured"}</td>
                <td>{tenant.entitlement ? <StatusPill tone={entitlementTone[tenant.entitlement.status]}>{tenant.entitlement.status}</StatusPill> : <span className="pf-muted">—</span>}</td>
                <td>{canManage ? <button type="button" className="secondary-button" onClick={() => { setError(null); setNotice(null); setEditingTenant(tenant); }}><CreditCard size={14} aria-hidden="true" />Set entitlement</button> : null}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>

      {editingTenant ? <EntitlementDialog tenant={editingTenant} onClose={() => setEditingTenant(null)} onSave={async (planId, status, dates) => { setError(null); setNotice(null); setWorking(true); try { await setEntitlement({ tenantId: editingTenant._id, planId, status, ...dates }); setNotice(`${editingTenant.name} entitlement was set to ${planId} · ${status}.`); setEditingTenant(null); } catch (caught) { setError(caught instanceof Error ? caught.message : "Entitlement could not be updated."); } finally { setWorking(false); }} } working={working} /> : null}
    </div>
  );
}

type EntitlementDates = { startsAt?: number; expiresAt?: number; trialEndsAt?: number };

function toLocalInput(ms: number): string {
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function parseLocalInput(value: string): number | undefined {
  return value ? new Date(value).getTime() : undefined;
}

function EntitlementDialog({ tenant, onClose, onSave, working }: { tenant: PlatformTenant; onClose: () => void; onSave: (planId: string, status: EntitlementStatus, dates: EntitlementDates) => Promise<void>; working: boolean }) {
  const [planId, setPlanId] = useState(tenant.entitlement?.planId ?? "");
  const [status, setStatus] = useState<EntitlementStatus>(tenant.entitlement?.status ?? "trial");
  const [startsAt, setStartsAt] = useState(tenant.entitlement?.startsAt ? toLocalInput(tenant.entitlement.startsAt) : "");
  const [expiresAt, setExpiresAt] = useState(tenant.entitlement?.expiresAt ? toLocalInput(tenant.entitlement.expiresAt) : "");
  const [trialEndsAt, setTrialEndsAt] = useState(tenant.entitlement?.trialEndsAt ? toLocalInput(tenant.entitlement.trialEndsAt) : "");

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!planId.trim()) return;
    await onSave(planId.trim(), status, {
      startsAt: parseLocalInput(startsAt),
      expiresAt: parseLocalInput(expiresAt),
      trialEndsAt: parseLocalInput(trialEndsAt),
    });
  };

  return (
    <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label={`Set entitlement for ${tenant.name}`} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="profile-modal-dialog" onSubmit={submit}>
        <header className="profile-modal-header"><div><p className="eyebrow">Subscription control</p><h2 className="page-title">{tenant.name}</h2></div><button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header>
        <div className="modal-body">
          <p className="pf-hint">Set the entitlement planId and lifecycle status for this tenant, and optionally its start, expiry, and trial-end timestamps (in your local timezone). This does not create or process invoices — use billing tools for payments.</p>
          <div className="form-grid">
            <Field label="Plan ID"><TextInput required value={planId} onChange={(event) => setPlanId(event.target.value)} placeholder="e.g. starter, standard, premium" /></Field>
            <label className="pf-field"><span className="pf-label">Status</span>
              <select className="pf-input" value={status} onChange={(event) => setStatus(event.target.value as EntitlementStatus)}>
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="expired">Expired</option>
                <option value="suspended">Suspended</option>
              </select>
            </label>
            <Field label="Starts at"><TextInput type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} /></Field>
            <Field label="Expires at"><TextInput type="datetime-local" value={expiresAt} onChange={(event) => setExpiresAt(event.target.value)} /></Field>
            <Field label="Trial ends at"><TextInput type="datetime-local" value={trialEndsAt} onChange={(event) => setTrialEndsAt(event.target.value)} /></Field>
          </div>
        </div>
        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
          <button type="submit" className="primary-button" disabled={working || !planId.trim()}>{working ? "Saving…" : "Save entitlement"}</button>
        </div>
      </form>
    </div>
  );
}