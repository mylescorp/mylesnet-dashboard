"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  Link2,
  PauseCircle,
  Pencil,
  PlayCircle,
  RotateCcw,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { tenantControl, type EntitlementStatus, type TenantStatus } from "@/lib/convex/tenantControl";
import { useUserProfile } from "./UserProfileContext";
import { StatusPill, EmptyState, formatDateTime } from "./ui";

const formatTs = (ts: number | null | undefined) => formatDateTime(ts ?? undefined);

const entitlementTone: Record<EntitlementStatus, "success" | "warning" | "danger"> = {
  active: "success",
  trial: "warning",
  expired: "danger",
  suspended: "danger",
};

const statusTone: Record<TenantStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  trial: "warning",
  suspended: "danger",
  cancelled: "neutral",
  pending_deletion: "danger",
};

export function PlatformTenantDetail({ tenantId }: { tenantId: string }) {
  const { user } = useUserProfile();
  const detail = useQuery(tenantControl.getTenantDetail, { tenantId });
  const setStatus = useMutation(tenantControl.setStatus);
  const requestDeletion = useMutation(tenantControl.requestTenantDeletion);
  const restoreTenant = useMutation(tenantControl.restoreTenant);
  const purgeTenant = useMutation(tenantControl.purgeTenant);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");
  const [showRequestDeletion, setShowRequestDeletion] = useState(false);
  const [confirmPurge, setConfirmPurge] = useState(false);

  const tenant = detail;
  if (tenant === undefined) return <p className="pf-muted">Loading tenant detail…</p>;
  if (tenant === null) return <EmptyState title="Tenant not found" body="This tenant does not exist in the platform directory." />;

  const changeStatus = async (status: "active" | "suspended") => {
    setError(null); setNotice(null); setWorking(true);
    try {
      await setStatus({ tenantId, status });
      setNotice(`${tenant.name} is now ${status}.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tenant status could not be changed.");
    } finally { setWorking(false); }
  };

  const reinstate = async () => {
    setError(null); setNotice(null); setWorking(true);
    try {
      await restoreTenant({ tenantId });
      setNotice(`${tenant.name} was reinstated.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tenant could not be restored.");
    } finally { setWorking(false); }
  };

  const initiateDeletion = async () => {
    setError(null); setNotice(null); setWorking(true);
    try {
      await requestDeletion({ tenantId, deleteReason });
      setNotice(`${tenant.name} was marked for deletion; the 30-day retention window is now active.`);
      setDeleteReason(""); setShowRequestDeletion(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tenant deletion could not be requested.");
    } finally { setWorking(false); }
  };

  const purge = async () => {
    setError(null); setNotice(null); setWorking(true); setConfirmPurge(false);
    try {
      await purgeTenant({ tenantId });
      setNotice(`${tenant.name} was purged and removed from the active tenant estate.`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Tenant purge failed.");
    } finally { setWorking(false); }
  };

  const canManage = user?.roles.some((role) => ["platform_owner", "platform_admin"].includes(role.slug));
  const canPurge = user?.roles.some((role) => ["platform_owner", "platform_admin"].includes(role.slug));
  const purgeEligibleNow = tenant.status === "pending_deletion" && tenant.purgeEligible;
  const daysRemaining = tenant.retentionDaysRemaining ?? 0;

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow"><Link href="/platform/tenants" className="platform-back-link"><ArrowLeft size={15} aria-hidden="true" />Tenants</Link></p>
          <h1 className="page-title">{tenant.name}</h1>
          <p className="page-subtitle">Tenant detail: identity mapping, lifecycle state, entitlement, and the members with access to this workspace.</p>
        </div>
        {canManage ? (
          <div style={{ display: "flex", gap: 8 }}>
            {tenant.status === "suspended"
              ? <button type="button" className="secondary-button" disabled={working} onClick={() => void changeStatus("active")}><PlayCircle size={15} aria-hidden="true" />Activate</button>
              : tenant.status === "pending_deletion"
                ? <button type="button" className="secondary-button" disabled={working} onClick={() => void reinstate()}><RotateCcw size={15} aria-hidden="true" />Restore</button>
                : <>
                    <button type="button" className="secondary-button" disabled={working || tenant.status === "cancelled"} onClick={() => void changeStatus("suspended")}><PauseCircle size={15} aria-hidden="true" />Suspend</button>
                    {tenant.status !== "cancelled" ? <button type="button" className="secondary-button" disabled={working} onClick={() => { setError(null); setNotice(null); setShowRequestDeletion(true); }}><Trash2 size={15} aria-hidden="true" />Delete</button> : null}
                  </>}
          </div>
        ) : null}
      </header>

      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

      {tenant.status === "pending_deletion" && tenant.deletionRequestedAt !== null ? (
        <section className="pf-panel" style={{ marginBottom: 24 }}>
          <div className="section-heading"><div><p className="eyebrow">Retention window</p><h2>Pending deletion</h2></div><span className="section-count">{purgeEligibleNow ? "Purge eligible" : `${daysRemaining} day(s) remaining`}</span></div>
          <dl className="tenant-detail-fields">
            <dt>Requested</dt><dd>{formatTs(tenant.deletionRequestedAt)}</dd>
            <dt>Reason</dt><dd>{tenant.deleteReason ?? "No reason recorded"}</dd>
            <dt>Purge eligible</dt><dd>{formatTs(tenant.purgeEligibleAt)}</dd>
          </dl>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            {canPurge && purgeEligibleNow ? <button type="button" className="secondary-button" disabled={working} onClick={() => setConfirmPurge(true)}><Trash2 size={15} aria-hidden="true" />Purge tenant</button> : null}
          </div>
        </section>
      ) : null}

      <section className="metric-grid">
        <Metric icon={<Building2 size={19} />} label="Lifecycle status" value={<StatusPill tone={statusTone[tenant.status]}>{tenant.status}</StatusPill>} detail="Tenant directory state" />
        <Metric icon={<Link2 size={19} />} label="WorkOS identity" value={tenant.workosOrganizationId ? "Mapped" : "Missing"} detail={tenant.workosOrganizationId ?? "Not connected"} tone={tenant.workosOrganizationId ? "success" : "warning"} />
        <Metric icon={<UsersRound size={19} />} label="Active members" value={tenant.activeMemberCount} detail="Users with active access to this workspace" tone={tenant.activeMemberCount > 0 ? "success" : "warning"} />
        <Metric icon={<Pencil size={19} />} label="Entitlement" value={tenant.entitlement ? tenant.entitlement.planId : "Not configured"} detail={tenant.entitlement ? tenant.entitlement.status : "Add a subscription from the Subscriptions panel"} tone={tenant.entitlement ? entitlementTone[tenant.entitlement.status] : "warning"} />
      </section>

      <section className="pf-panel" style={{ marginTop: 24 }}>
        <div className="section-heading"><div><p className="eyebrow">Identity</p><h2>Workspace record</h2></div></div>
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

      {showRequestDeletion ? (
        <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Request tenant deletion" onClick={(event) => { if (event.target === event.currentTarget && !working) setShowRequestDeletion(false); }}>
          <form className="profile-modal-dialog" onSubmit={(event) => { event.preventDefault(); void initiateDeletion(); }}>
            <header className="profile-modal-header"><div><p className="eyebrow">Retention window</p><h2 className="page-title">Request tenant deletion</h2></div><button type="button" className="profile-modal-close" onClick={() => setShowRequestDeletion(false)} aria-label="Close dialog">×</button></header>
            <div className="modal-body">
              <p className="pf-hint"><AlertTriangle size={15} aria-hidden="true" /> {tenant.name} will move to <strong>pending deletion</strong>. Access gate is denied immediately; a purge becomes possible only after the 30-day retention window, and a restore stays available until then. No records are destroyed by this action.</p>
              {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
              <label className="pf-field"><span className="pf-label">Reason for deletion</span><textarea className="pf-input" required value={deleteReason} onChange={(event) => setDeleteReason(event.target.value)} placeholder="e.g. Operator discontinued service; 30-day window before final purge" /></label>
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="secondary-button" disabled={working} onClick={() => setShowRequestDeletion(false)}>Cancel</button>
                <button type="submit" className="primary-button" disabled={working}>Mark for deletion</button>
              </div>
            </div>
          </form>
        </div>
      ) : null}

      {confirmPurge ? (
        <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Confirm tenant purge" onClick={(event) => { if (event.target === event.currentTarget && !working) setConfirmPurge(false); }}>
          <div className="profile-modal-dialog">
            <header className="profile-modal-header"><div><p className="eyebrow">Retention window elapsed</p><h2 className="page-title">Purge {tenant.name}?</h2></div><button type="button" className="profile-modal-close" onClick={() => setConfirmPurge(false)} aria-label="Close dialog">×</button></header>
            <div className="modal-body">
              <p className="pf-hint"><AlertTriangle size={15} aria-hidden="true" /> This is a super-admin-only final step after the 30-day window. The tenant leaves the active estate; its record and audit trail are retained. This action is immediate and cannot be undone.</p>
              {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
              <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button type="button" className="secondary-button" disabled={working} onClick={() => setConfirmPurge(false)}>Keep tenant</button>
                <button type="button" className="primary-button" disabled={working} onClick={() => void purge()}><Trash2 size={14} aria-hidden="true" />Purge tenant</button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Metric({ icon, label, value, detail, tone = "accent" }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; tone?: "accent" | "success" | "warning" | "danger" }) {
  return <article className={`metric-card workspace-card metric-card-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}
