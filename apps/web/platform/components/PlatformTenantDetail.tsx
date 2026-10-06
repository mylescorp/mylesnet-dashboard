"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Link2,
  Pencil,
  UsersRound,
} from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useState } from "react";
import { tenantControl, type EntitlementStatus, type TenantStatus } from "@/lib/convex/tenantControl";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { StatusPill, EmptyState, formatDateTime } from "@/shared/components/ui";
import { canManagePlatformTenants } from "@/platform/permissions";

const formatTs = (ts: number | null | undefined) => formatDateTime(ts ?? undefined);

const entitlementTone: Record<EntitlementStatus, "success" | "warning" | "danger"> = {
  active: "success",
  trial: "warning",
  expired: "danger",
  suspended: "danger",
};

const statusTone: Record<TenantStatus, "success" | "warning" | "danger" | "neutral"> = {
  provisioning: "warning",
  active: "success",
  trial: "warning",
  suspended: "danger",
  cancelled: "neutral",
};

export function PlatformTenantDetail({ tenantId }: { tenantId: string }) {
  const { user } = useUserProfile();
  const detail = useQuery(tenantControl.getTenantDetail, { tenantId });
  const updateTenant = useMutation(tenantControl.updateTenant);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManagePlatformTenants(user?.roles.map((role) => role.slug));

  const tenant = detail;
  if (tenant === undefined) return <p className="pf-muted">Loading tenant detail…</p>;
  if (tenant === null) return <EmptyState title="Tenant not found" body="This tenant does not exist in the platform directory." />;



  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow"><Link href="/platform/organizations" className="platform-back-link"><ArrowLeft size={15} aria-hidden="true" />Tenants</Link></p>
          <h1 className="page-title">{tenant.name}</h1>
          <p className="page-subtitle">Tenant detail: identity mapping, lifecycle state, entitlement, and the members with access to this workspace.</p>
        </div>
        {canManage && tenant.status !== "cancelled" && tenant.status !== "provisioning" ? (
          <Link href={`/platform/organizations/${tenantId}/${tenant.status === "suspended" ? "restore" : "suspend"}`} className="secondary-button">{tenant.status === "suspended" ? "Restore organization" : "Suspend organization"}</Link>
        ) : null}
      </header>


      <section className="metric-grid">
        <Metric icon={<Building2 size={19} />} label="Lifecycle status" value={<StatusPill tone={statusTone[tenant.status]}>{tenant.status}</StatusPill>} detail="Tenant directory state" />
        <Metric icon={<Link2 size={19} />} label="Workspace access" value={tenant.workosOrganizationId ? "Ready" : "Preparing"} detail={tenant.workosOrganizationId ? "Secure access configured" : "Access setup is in progress"} tone={tenant.workosOrganizationId ? "success" : "warning"} />
        <Metric icon={<UsersRound size={19} />} label="Active members" value={tenant.activeMemberCount} detail="Users with active access to this workspace" tone={tenant.activeMemberCount > 0 ? "success" : "warning"} />
        <Metric icon={<Pencil size={19} />} label="Entitlement" value={tenant.entitlement ? tenant.entitlement.planId : "Not configured"} detail={tenant.entitlement ? tenant.entitlement.status : "Add a subscription from the Subscriptions panel"} tone={tenant.entitlement ? entitlementTone[tenant.entitlement.status] : "warning"} />
      </section>

      <section className="pf-panel" style={{ marginTop: 24 }}>
        <div className="section-heading"><div><p className="eyebrow">Organization</p><h2>Markets</h2><p className="pf-muted">Manage market locations within this tenant.</p></div><Link href={`/platform/organizations/${tenantId}/markets`} className="pf-button pf-button-compact">Manage markets</Link></div>
      </section>

      <section className="pf-panel" style={{ marginTop: 24 }}>
        <div className="section-heading"><div><p className="eyebrow">Identity</p><h2>Workspace record</h2></div>{canManage ? <button type="button" className="secondary-button" onClick={() => { setEditing(value => !value); setError(null); setNotice(null); }}>{editing ? "Cancel edit" : "Edit details"}</button> : null}</div>
        {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
        {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
        {editing ? <form className="pf-panel" onSubmit={async event => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          setSaving(true); setError(null); setNotice(null);
          try {
            await updateTenant({ tenantId, name: String(data.get("name") ?? ""), country: String(data.get("country") ?? ""), timezone: String(data.get("timezone") ?? ""), currency: String(data.get("currency") ?? "") });
            setEditing(false); setNotice("Organization details updated.");
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Organization details could not be updated.");
          } finally { setSaving(false); }
        }}>
          <div className="form-grid">
            <label className="pf-field"><span className="pf-label">Name</span><input className="pf-input" name="name" required maxLength={120} defaultValue={tenant.name} /></label>
            <label className="pf-field"><span className="pf-label">Country (ISO code)</span><input className="pf-input" name="country" required minLength={2} maxLength={2} defaultValue={tenant.country} /></label>
            <label className="pf-field"><span className="pf-label">Timezone</span><input className="pf-input" name="timezone" required defaultValue={tenant.timezone} /></label>
            <label className="pf-field"><span className="pf-label">Currency (ISO code)</span><input className="pf-input" name="currency" required minLength={3} maxLength={3} defaultValue={tenant.currency} /></label>
          </div>
          <button className="pf-button" disabled={saving}>{saving ? "Saving…" : "Save organization details"}</button>
        </form> : null}
        <dl className="tenant-detail-fields">
          <dt>Slug</dt><dd><code>{tenant.slug}</code></dd>
          <dt>Country</dt><dd>{tenant.country}</dd>
          <dt>Timezone</dt><dd>{tenant.timezone}</dd>
          <dt>Currency</dt><dd>{tenant.currency}</dd>
          <dt>Created</dt><dd>{formatTs(tenant.createdAt)}</dd>
          <dt>Last updated</dt><dd>{formatTs(tenant.updatedAt)}</dd>
        </dl>
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Entitlement</p><h2>Current plan</h2></div>{canManage ? <Link href="/platform/subscriptions" className="pf-button pf-button-compact">Edit subscriptions</Link> : null}</div>
        {tenant.entitlement ? (
          <dl className="tenant-detail-fields">
            <dt>Plan</dt><dd>{tenant.entitlement.planId}</dd>
            <dt>Status</dt><dd><StatusPill tone={entitlementTone[tenant.entitlement.status]}>{tenant.entitlement.status}</StatusPill></dd>
            <dt>Starts</dt><dd>{formatTs(tenant.entitlement.startsAt)}</dd>
            <dt>Expires</dt><dd>{formatTs(tenant.entitlement.expiresAt)}</dd>
            <dt>Trial ends</dt><dd>{formatTs(tenant.entitlement.trialEndsAt)}</dd>
          </dl>
        ) : <p className="pf-muted">No entitlement record has been created for this tenant yet.</p>}
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Access</p><h2>Members</h2></div><span className="section-count">{tenant.members.length} total</span></div>
        {tenant.members.length === 0 ? <p className="pf-muted">No membership records were found for this tenant.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>User</th><th>Role</th><th>Status</th><th>Joined</th></tr></thead><tbody>
            {tenant.members.map((member) => (
              <tr key={member.userId}>
                <td><strong>{member.name ?? "Unnamed user"}</strong><small className="table-subtext">{member.email}</small></td>
                <td>{member.role}</td>
                <td><StatusPill tone={member.status === "active" ? "success" : member.status === "pending" ? "warning" : "danger"}>{member.status}</StatusPill></td>
                <td>{formatTs(member.joinedAt)}</td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}

function Metric({ icon, label, value, detail, tone = "accent" }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; tone?: "accent" | "success" | "warning" | "danger" }) {
  return <article className={`metric-card workspace-card metric-card-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}
