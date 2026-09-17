"use client";

import {
  CircleCheck,
  CircleHelp,
  ShieldCheck,
  Webhook,
  Flag,
  UserCheck,
} from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { platformPanel, type SecurityStaffEntry } from "@/lib/convex/platformPanel";
import { StatusPill } from "@/shared/components/ui";

export function PlatformSecurity() {
  const security = useQuery(platformPanel.getPlatformSecurityOverview, {});

  if (security === undefined) return (
    <div className="workspace-page">
      <header className="page-heading"><div><p className="eyebrow">Platform control plane</p><h1 className="page-title">Security</h1></div></header>
      <p className="pf-muted">Loading security posture…</p>
    </div>
  );

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Security</h1>
          <p className="page-subtitle">Access coverage, optional account security, delivery health, and feature-flag state across the platform.</p>
        </div>
      </header>

      <section className="metric-grid">
        <Metric icon={<ShieldCheck size={19} />} label="Access configured" value={`${security.tenantOverview.identityMapped}/${security.tenantOverview.total}`} detail="Tenant workspaces with secure access" tone={security.tenantOverview.identityMapped === security.tenantOverview.total ? "success" : "warning"} />
        <Metric icon={<UserCheck size={19} />} label="MFA enrolled" value={security.staffMfaEnrolled} detail={`Optional for ${security.staff.length} platform staff`} tone="accent" />
        <Metric icon={<Webhook size={19} />} label="Webhooks (24h)" value={`${security.deliveries24h.processed}/${security.deliveries24h.total}`} detail={`${security.deliveries24h.signatureInvalid} invalid signatures`} tone={security.deliveries24h.signatureInvalid === 0 ? "success" : "warning"} />
        <Metric icon={<Flag size={19} />} label="Feature flags" value={Object.values(security.featureFlags).filter(Boolean).length} detail={`${Object.keys(security.featureFlags).length} tracked flags`} tone={Object.values(security.featureFlags).some(Boolean) ? "success" : "accent"} />
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Access</p><h2>Workspace access coverage</h2></div></div>
        <dl className="tenant-detail-fields">
          <dt>Total tenants</dt><dd>{security.tenantOverview.total}</dd>
          <dt>Active</dt><dd>{security.tenantOverview.active}</dd>
          <dt>Trial</dt><dd>{security.tenantOverview.trial}</dd>
          <dt>Suspended</dt><dd>{security.tenantOverview.suspended}</dd>
          <dt>Cancelled</dt><dd>{security.tenantOverview.cancelled}</dd>
          <dt>Access configured</dt><dd>{security.tenantOverview.identityMapped}</dd>
        </dl>
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Account security</p><h2>Optional MFA</h2></div></div>
        <p className="pf-muted">MFA is available to every user as an optional account-security preference. It does not restrict access to any MylesNet panel or workflow.</p>
        {security.staff.length === 0 ? <p className="pf-muted">No platform staff are provisioned yet.</p> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>User</th><th>Roles</th><th>Availability</th><th>Enrolment</th><th>Status</th></tr></thead><tbody>
            {security.staff.map((staff: SecurityStaffEntry) => (
              <tr key={staff.userId}>
                <td><strong>{staff.name ?? "Unnamed"}</strong><small className="table-subtext">{staff.email}</small></td>
                <td>{staff.roles.join(", ")}</td>
                <td>{staff.mfaOptional ? "Optional" : "—"}</td>
                <td>{staff.mfaEnrolled ? <span className="tenant-linked"><CircleCheck size={14} aria-hidden="true" />Enrolled</span> : <span className="tenant-unlinked"><CircleHelp size={14} aria-hidden="true" />Not enrolled</span>}</td>
                <td><StatusPill tone={staff.status === "enrolled" ? "success" : "neutral"}>{staff.status === "enrolled" ? "enabled" : "not configured"}</StatusPill></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Delivery health</p><h2>Identity event queue</h2></div></div>
        <dl className="tenant-detail-fields">
          <dt>Received</dt><dd>{security.workosEvents.received}</dd>
          <dt>Completed</dt><dd>{security.workosEvents.completed}</dd>
          <dt>Retry</dt><dd>{security.workosEvents.retry}</dd>
          <dt>Quarantined</dt><dd>{security.workosEvents.quarantined}</dd>
        </dl>
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Delivery health</p><h2>Last 24 hours</h2></div></div>
        <dl className="tenant-detail-fields">
          <dt>Total deliveries</dt><dd>{security.deliveries24h.total}</dd>
          <dt>Processed</dt><dd>{security.deliveries24h.processed}</dd>
          <dt>Invalid signatures</dt><dd>{security.deliveries24h.signatureInvalid}</dd>
        </dl>
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Feature flags</p><h2>Runtime state</h2></div></div>
        <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Flag</th><th>State</th></tr></thead><tbody>
          {Object.entries(security.featureFlags).map(([key, value]) => (
            <tr key={key}><td><code>{key}</code></td><td><StatusPill tone={value ? "success" : "neutral"}>{value ? "enabled" : "disabled"}</StatusPill></td></tr>
          ))}
        </tbody></table></div>
      </section>
    </div>
  );
}

function Metric({ icon, label, value, detail, tone = "accent" }: { icon: React.ReactNode; label: string; value: number | string; detail: string; tone?: "accent" | "success" | "warning" | "danger" }) {
  return <article className={`metric-card workspace-card metric-card-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}
