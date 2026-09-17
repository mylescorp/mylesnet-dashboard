"use client";

import Link from "next/link";
import {
  Building2,
  CircleAlert,
  CreditCard,
  Flag,
  Link2,
  ScrollText,
  ShieldCheck,
  TicketCheck,
  Users,
} from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { tenantControl, type PlatformTenant, type TenantStatus } from "@/lib/convex/tenantControl";
import { platformPanel } from "@/lib/convex/platformPanel";

const statusTone: Record<TenantStatus, "success" | "warning" | "danger" | "neutral"> = {
  provisioning: "warning",
  active: "success",
  trial: "warning",
  suspended: "danger",
  cancelled: "neutral",
};

function Metric({ icon, label, value, detail, tone = "accent" }: { icon: React.ReactNode; label: string; value: number | string; detail: string; tone?: "accent" | "success" | "warning" | "danger" }) {
  return <article className={`metric-card workspace-card metric-card-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}

export function PlatformOverview() {
  const tenants = useQuery(tenantControl.listForPlatform, {});
  const security = useQuery(platformPanel.getPlatformSecurityOverview, {});

  const totals = {
    total: tenants?.length ?? 0,
    active: tenants?.filter((t) => t.status === "active").length ?? 0,
    trial: tenants?.filter((t) => t.status === "trial").length ?? 0,
    suspended: tenants?.filter((t) => t.status === "suspended").length ?? 0,
    littleIdentity: tenants?.filter((t) => !t.workosOrganizationId).length ?? 0,
    limitedEntitlement: tenants?.filter((t) => t.entitlement && (t.entitlement.status === "expired" || t.entitlement.status === "suspended")).length ?? 0,
  };

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Overview</h1>
          <p className="page-subtitle">The MylesCorp control plane: tenant lifecycle, subscriptions, access, audit, and security across the whole product portfolio.</p>
        </div>
        <Link className="primary-button" href="/platform/tenants"><Building2 size={17} aria-hidden="true" />Manage tenants</Link>
      </header>

      <section className="metric-grid" aria-label="Platform summary">
        <Metric icon={<Building2 size={19} />} label="Registered tenants" value={totals.total} detail={`${totals.active} active · ${totals.trial} trial`} />
        <Metric icon={<Link2 size={19} />} label="Workspace access" value={totals.total - totals.littleIdentity} detail={`${totals.littleIdentity} tenant(s) need secure access setup`} tone={totals.littleIdentity ? "warning" : "success"} />
        <Metric icon={<CreditCard size={19} />} label="Entitlement risk" value={totals.limitedEntitlement} detail="Expired or suspended plans that need attention" tone={totals.limitedEntitlement ? "warning" : "success"} />
        <Metric icon={<ShieldCheck size={19} />} label="Staff MFA gaps" value={security?.staffMissingMfa ?? 0} detail={`${security?.staff.length ?? 0} platform staff on record`} tone={security && security.staffMissingMfa > 0 ? "warning" : "success"} />
      </section>

      <section className="pf-panel" style={{ marginTop: 28 }}>
        <div className="section-heading"><div><p className="eyebrow">Control planes</p><h2>Sub-panels</h2></div><span className="section-count">7 surfaces</span></div>
        <div className="platform-actions-grid">
          <PlaneCard href="/platform/tenants" icon={<Building2 size={20} />} title="Tenants" body="Register verified operators, review identity readiness, and manage lifecycle state." />
          <PlaneCard href="/platform/subscriptions" icon={<CreditCard size={20} />} title="Subscriptions" body="Set plans and entitlement status per tenant, including trial windows and expiry." />
          <PlaneCard href="/platform/access" icon={<Users size={20} />} title="Access & roles" body="Platform staff, roles, permissions, and pending invitations at a glance." />
          <PlaneCard href="/platform/audit" icon={<ScrollText size={20} />} title="Audit log" body="Searchable, paginated trail of every entity change across the platform." />
          <PlaneCard href="/platform/security" icon={<ShieldCheck size={20} />} title="Security" body="Access coverage, staff MFA posture, webhook health, and feature flags." />
          <PlaneCard href="/platform/vouchers/monitor" icon={<TicketCheck size={20} />} title="Voucher monitor" body="Duplicate, velocity, and geo-anomaly signals on redeemed vouchers." />
          <PlaneCard href="/platform/feature-flags" icon={<Flag size={20} />} title="Feature flags" body="Global toggles, percentage rollouts, and per-tenant overrides." />
        </div>
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Tenant estate</p><h2>Most recent tenants</h2></div><span className="section-count">{totals.total} total</span></div>
        {tenants === undefined ? <p className="pf-muted">Loading tenant inventory…</p> : tenants.length === 0 ? <p className="pf-muted">No tenant is registered yet. Register the first verified operator from the Tenants panel.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Tenant</th><th>Identity</th><th>Plan</th><th>Status</th><th /></tr></thead><tbody>
            {tenants.slice(0, 8).map((tenant: PlatformTenant) => (
              <tr key={tenant._id}>
                <td><Link href={`/platform/tenants/${tenant._id}`} className="tenant-name-link"><strong>{tenant.name}</strong></Link><small className="table-subtext">{tenant.slug} · {tenant.country}</small></td>
                <td>{tenant.workosOrganizationId ? <span className="tenant-linked"><Link2 size={14} aria-hidden="true" />Connected</span> : <span className="tenant-unlinked"><CircleAlert size={14} aria-hidden="true" />Missing mapping</span>}</td>
                <td>{tenant.entitlement ? `${tenant.entitlement.planId} · ${tenant.entitlement.status}` : "Not configured"}</td>
                <td><span className={`status-pill status-pill-${statusTone[tenant.status]}`}>{tenant.status}</span></td>
                <td><Link href={`/platform/tenants/${tenant._id}`} className="pf-button pf-button-compact">Open</Link></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </div>
  );
}

function PlaneCard({ href, icon, title, body }: { href: string; icon: React.ReactNode; title: string; body: string }) {
  return (
    <Link href={href} className="platform-plane-card">
      <span className="metric-icon">{icon}</span>
      <div><strong>{title}</strong><p>{body}</p></div>
    </Link>
  );
}
