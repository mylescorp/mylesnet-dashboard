"use client";

import { userFacingMessage } from "@/shared/lib/user-facing-error";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Link2,
  PauseCircle,
  PlayCircle,
  Pencil,
  RotateCcw,
  Trash2,
  UsersRound,
} from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { tenantControl, type EntitlementStatus, type TenantStatus } from "@/lib/convex/tenantControl";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { canDeletePlatformTenant, canManagePlatformTenants } from "@/platform/permissions";
import { StatusPill, EmptyState, formatDateTime } from "@/shared/components/ui";

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
  pending_deletion: "warning",
  cancelled: "neutral",
};

export function PlatformTenantDetail({ tenantId }: { tenantId: string }) {
  const { user } = useUserProfile();
  const detail = useQuery(tenantControl.getTenantDetail, { tenantId });
  const setStatus = useMutation(tenantControl.setStatus);
  const scheduleDeletion = useMutation(tenantControl.scheduleDeletion);
  const restoreScheduledDeletion = useMutation(tenantControl.restoreScheduledDeletion);
  const [working, setWorking] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [deletionReason, setDeletionReason] = useState("");
  const [requestingDeletion, setRequestingDeletion] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManagePlatformTenants(user?.roles.map((role) => role.slug));
  const canScheduleDeletion = canDeletePlatformTenant(user?.roles.map((role) => role.slug));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const tenant = detail;
  if (tenant === undefined) return <p className="pf-muted">Loading tenant detail…</p>;
  if (tenant === null) return <EmptyState title="Tenant not found" body="This tenant does not exist in the platform directory." />;

  const changeStatus = async (status: "active" | "suspended") => {
    setError(null); setNotice(null); setWorking(true);
    try {
      await setStatus({ tenantId, status });
      setNotice(`${tenant.name} is now ${status}.`);
    } catch (caught) {
      setError(userFacingMessage(caught, "Tenant status could not be changed."));
    } finally { setWorking(false); }
  };

  const requestDeletion = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null); setNotice(null); setWorking(true);
    try {
      const result = await scheduleDeletion({ tenantId, reason: deletionReason.trim() });
      setDeletionReason("");
      setRequestingDeletion(false);
      setNotice(`Tenant access is suspended. The 30-day recovery window ends ${formatTs(result.scheduledDeletionAt)}.`);
    } catch (caught) {
      setError(userFacingMessage(caught, "The tenant recovery window could not be started."));
    } finally { setWorking(false); }
  };

  const restoreDeletion = async () => {
    setError(null); setNotice(null); setWorking(true);
    try {
      const result = await restoreScheduledDeletion({ tenantId });
      setNotice(`${tenant.name} was restored to ${result.status}.`);
    } catch (caught) {
      setError(userFacingMessage(caught, "The tenant could not be restored."));
    } finally { setWorking(false); }
  };

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
              : <button type="button" className="secondary-button" disabled={working || tenant.status === "cancelled" || tenant.status === "provisioning"} onClick={() => void changeStatus("suspended")}><PauseCircle size={15} aria-hidden="true" />Suspend</button>}
          </div>
        ) : null}
      </header>

      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

      {tenant.scheduledDeletionAt !== null && tenant.status === "pending_deletion" ? (
        <section className="pf-panel" aria-labelledby="tenant-retention-heading">
          <div className="section-heading">
            <div><p className="eyebrow">30-day recovery window</p><h2 id="tenant-retention-heading">Deletion requested</h2></div>
            <StatusPill tone={tenant.scheduledDeletionAt > now ? "warning" : "neutral"}>{tenant.scheduledDeletionAt > now ? "Access suspended" : "Window elapsed"}</StatusPill>
          </div>
          <p>{tenant.scheduledDeletionAt > now
            ? `Tenant access is suspended. Restore before ${formatTs(tenant.scheduledDeletionAt)} to return the workspace to service.`
            : `The recovery window ended ${formatTs(tenant.scheduledDeletionAt)}. Restoration is no longer available.`}</p>
          {tenant.deletionReason ? <p className="pf-muted">Reason: {tenant.deletionReason}</p> : null}
          {canManage && tenant.scheduledDeletionAt > now ? <button type="button" className="secondary-button" disabled={working} onClick={() => void restoreDeletion()}><RotateCcw size={15} aria-hidden="true" />Restore tenant</button> : null}
        </section>
      ) : null}

      {canScheduleDeletion && tenant.scheduledDeletionAt === null && ["trial", "active", "suspended"].includes(tenant.status) ? (
        <section className="pf-panel" aria-labelledby="tenant-deletion-heading">
          <div className="section-heading"><div><p className="eyebrow">Tenant lifecycle</p><h2 id="tenant-deletion-heading">Request deletion</h2></div><Trash2 size={18} aria-hidden="true" /></div>
          <p>Tenant access will stop immediately. The workspace enters a 30-day recovery window; records are retained after that window for the approved data-retention workflow.</p>
          {requestingDeletion ? (
            <form className="pf-stack" onSubmit={(event) => void requestDeletion(event)}>
              <label className="pf-field"><span className="pf-label">Reason (required)</span><textarea className="pf-input" required minLength={8} maxLength={500} rows={3} value={deletionReason} onChange={(event) => setDeletionReason(event.target.value)} /></label>
              <p className="pf-hint">This action suspends tenant access immediately and is recorded in the audit log.</p>
              <div className="pf-actions"><button type="button" className="secondary-button" disabled={working} onClick={() => setRequestingDeletion(false)}>Cancel</button><button type="submit" className="danger-button" disabled={working || deletionReason.trim().length < 8}>{working ? "Starting recovery window…" : "Start 30-day recovery window"}</button></div>
            </form>
          ) : <button type="button" className="secondary-button" onClick={() => setRequestingDeletion(true)}>Review deletion request</button>}
        </section>
      ) : null}

      <section className="metric-grid">
        <Metric icon={<Building2 size={19} />} label="Lifecycle status" value={<StatusPill tone={statusTone[tenant.status]}>{tenant.status}</StatusPill>} detail="Tenant directory state" />
        <Metric icon={<Link2 size={19} />} label="Workspace access" value={tenant.workosOrganizationId ? "Ready" : "Preparing"} detail={tenant.workosOrganizationId ? "Secure access configured" : "Access setup is in progress"} tone={tenant.workosOrganizationId ? "success" : "warning"} />
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
    </div>
  );
}

function Metric({ icon, label, value, detail, tone = "accent" }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; tone?: "accent" | "success" | "warning" | "danger" }) {
  return <article className={`metric-card workspace-card metric-card-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}
