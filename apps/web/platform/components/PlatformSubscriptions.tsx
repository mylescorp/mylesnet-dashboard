"use client";

import { userFacingMessage } from "@/shared/lib/user-facing-error";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { CreditCard } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { tenantControl, type SubscriptionTenant, type EntitlementStatus } from "@/lib/convex/tenantControl";
import { platformPlans, type PlatformPlan } from "@/shared/convex/platformPlans";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { Field, StatusPill, TextInput } from "@/shared/components/ui";
import { canDeletePlatformTenant, canManagePlatformTenants } from "@/platform/permissions";

const entitlementTone: Record<EntitlementStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  trial: "warning",
  expired: "danger",
  suspended: "danger",
};

export function PlatformSubscriptions() {
  const { user } = useUserProfile();
  const { results: tenants, status: tenantPageStatus, loadMore } = usePaginatedQuery(
    tenantControl.listSubscriptionsPage,
    {},
    { initialNumItems: 20 },
  );
  const plans = useQuery(platformPlans.list, {});
  const setEntitlement = useMutation(tenantControl.setEntitlement);
  const removeEntitlement = useMutation(tenantControl.removeEntitlement);
  const [editingTenant, setEditingTenant] = useState<SubscriptionTenant | null>(null);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManagePlatformTenants(user?.roles.map((role) => role.slug));
  const canDelete = canDeletePlatformTenant(user?.roles.map((role) => role.slug));

  return (
    <div className="workspace-page tenant-control-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Subscriptions</h1>
          <p className="page-subtitle">Set and adjust plan entitlements per tenant. These controls determine product access and do not change payment records.</p>
        </div>
      </header>

      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Entitlements</p><h2>Tenant plans</h2></div><span className="section-count">{tenants.length} loaded</span></div>
        {tenantPageStatus === "LoadingFirstPage" ? <p className="pf-muted">Loading subscriptions…</p> : tenants.length === 0 ? <p className="pf-muted">No tenants have been registered yet.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Tenant</th><th>Slug</th><th>Plan</th><th>Entitlement status</th><th /></tr></thead><tbody>
            {tenants.map((tenant: SubscriptionTenant) => (
              <tr key={tenant._id}>
                <td><strong>{tenant.name}</strong><small className="table-subtext">{tenant.country}</small></td>
                <td><code>{tenant.slug}</code></td>
                <td>{tenant.entitlement ? tenant.entitlement.planId : "Not configured"}</td>
                <td>{tenant.entitlement ? <StatusPill tone={entitlementTone[tenant.entitlement.status]}>{tenant.entitlement.status}</StatusPill> : <span className="pf-muted">—</span>}</td>
                <td>{canManage ? <div className="cell-actions"><button type="button" className="secondary-button" onClick={() => { setError(null); setNotice(null); setEditingTenant(tenant); }}><CreditCard size={14} aria-hidden="true" />{tenant.entitlement ? "Edit subscription" : "Create subscription"}</button>{canDelete && tenant.entitlement ? <button type="button" className="secondary-button" onClick={async () => {
                  const reason = window.prompt(`Reason for removing ${tenant.name}'s product subscription? This does not affect invoices or payment data.`)?.trim();
                  if (!reason) return;
                  setError(null); setNotice(null); setWorking(true);
                  try { await removeEntitlement({ tenantId: tenant._id, reason }); setNotice(`${tenant.name} product subscription removed.`); }
                  catch (caught) { setError(userFacingMessage(caught, "Subscription could not be removed.")); }
                  finally { setWorking(false); }
                }}>Remove</button> : null}</div> : null}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
        {tenantPageStatus === "CanLoadMore" || tenantPageStatus === "LoadingMore" ? <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => loadMore(20)} disabled={tenantPageStatus === "LoadingMore"}>{tenantPageStatus === "LoadingMore" ? "Loading…" : "Load more tenants"}</button></div> : null}
      </section>

      {editingTenant ? <EntitlementDialog tenant={editingTenant} plans={plans ?? []} onClose={() => setEditingTenant(null)} onSave={async (planId, status, dates) => { setError(null); setNotice(null); setWorking(true); try { await setEntitlement({ tenantId: editingTenant._id, planId, status, ...dates }); setNotice(`${editingTenant.name} entitlement was set to ${planId} · ${status}.`); setEditingTenant(null); } catch (caught) { setError(userFacingMessage(caught, "Entitlement could not be updated.")); } finally { setWorking(false); }} } working={working} /> : null}
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

function EntitlementDialog({ tenant, plans, onClose, onSave, working }: { tenant: SubscriptionTenant; plans: PlatformPlan[]; onClose: () => void; onSave: (planId: string, status: EntitlementStatus, dates: EntitlementDates) => Promise<void>; working: boolean }) {
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
          <p className="pf-hint">Set the entitlement planId and lifecycle status for this tenant, and optionally its start, expiry, and trial-end timestamps (in your local timezone). This changes plan entitlements only. Tenant invoices and payment collection are outside this panel’s approved scope (C2 is deferred).</p>
          <div className="form-grid">
            <label className="pf-field"><span className="pf-label">Plan</span><select className="pf-input" required value={planId} onChange={(event) => setPlanId(event.target.value)}><option value="">Choose a plan</option>{plans.filter(plan => plan.status === "active" || plan.code === tenant.entitlement?.planId).map(plan => <option key={plan.code} value={plan.code}>{plan.name} · {plan.code}{plan.status === "archived" ? " (current, archived)" : ""}</option>)}</select></label>
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
