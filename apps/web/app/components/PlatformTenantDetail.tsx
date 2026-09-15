"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Building2,
  Link2,
  PauseCircle,
  PlayCircle,
  Pencil,
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
};

export function PlatformTenantDetail({ tenantId }: { tenantId: string }) {
  const { user } = useUserProfile();
  const detail = useQuery(tenantControl.getTenantDetail, { tenantId });
  const setStatus = useMutation(tenantControl.setStatus);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.roles.some((role) => ["platform_owner", "platform_admin"].includes(role.slug));

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
              : <button type="button" className="secondary-button" disabled={working || tenant.status === "cancelled"} onClick={() => void changeStatus("suspended")}><PauseCircle size={15} aria-hidden="true" />Suspend</button>}
          </div>
        ) : null}
      </header>

      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

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
          <dt>Markets</dt><dd>{tenant.marketCount}</dd>
          <dt>Subscribers</dt><dd>{tenant.subscriberCount}</dd>
          <dt>Account owner</dt><dd>{tenant.accountOwner ? tenant.accountOwner.name ?? tenant.accountOwner.email : "No tenant admin yet"}</dd>
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
