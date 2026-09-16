"use client";

import Link from "next/link";
import {
  Building2,
  DollarSign,
  ShieldCheck,
  Ticket,
  UsersRound,
} from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { tenantControl, type TenantWorkspaceSetupReason } from "@/lib/convex/tenantControl";
import { dashboard } from "@/shared/convex/dashboard";
import MetricCard from "@/shared/components/MetricCard";

const n = (v: number) => v.toLocaleString("en", { maximumFractionDigits: 2 });

export function TenantWorkspace() {
  const workspace = useQuery(tenantControl.getCurrentWorkspace, {});
  const metrics = useQuery(dashboard.getMetrics, workspace?.status === "ready" ? {} : "skip");

  if (workspace === undefined)
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">
          Loading tenant workspace…
        </div>
      </div>
    );

  if (workspace.status === "setup_required") {
    return <TenantWorkspaceSetup reason={workspace.reason} />;
  }

  const tenantWorkspace = workspace.workspace;
  const revenueDisplay =
    metrics === undefined
      ? "Loading…"
      : `${metrics.currency} ${n(metrics.revenueToday)}`;
  const revenueDetail =
    metrics === undefined
      ? "Today's completed payments"
      : `${metrics.revenueTodayCount} completed payment${metrics.revenueTodayCount === 1 ? "" : "s"} today`;
  const newSignups = metrics === undefined ? 0 : metrics.newSignupsToday;
  const openTickets = metrics === undefined ? "—" : metrics.openTickets;

  return (
    <div className="workspace-page tenant-workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Tenant workspace</p>
          <h1 className="page-title">{tenantWorkspace.tenant.name}</h1>
          <p className="page-subtitle">
            Your operational workspace is bound to your active WorkOS
            organization membership. No tenant can be selected from the browser.
          </p>
        </div>
        <span
          className={`status-pill status-pill-${tenantWorkspace.tenant.status === "active" ? "success" : tenantWorkspace.tenant.status === "suspended" ? "danger" : "warning"}`}
        >
          {tenantWorkspace.tenant.status}
        </span>
      </header>

      <section className="metric-grid">
        <MetricCard
          icon={DollarSign}
          label="Revenue today"
          value={revenueDisplay}
          detail={revenueDetail}
          tone="primary"
        />
        <MetricCard
          icon={UsersRound}
          label="Active subscriptions"
          value={metrics === undefined ? "Loading…" : metrics.activeSubscriptions}
          detail="Current active subscribers"
          tone="success"
        />
        <MetricCard
          icon={UsersRound}
          label="New signups"
          value={newSignups}
          detail="Today's new subscribers"
          tone="accent"
        />
        <MetricCard
          icon={Ticket}
          label="Open tickets"
          value={openTickets}
          detail="Support queue is available from Tickets"
          tone="neutral"
        />
        <MetricCard
          icon={Building2}
          label="Active sites"
          value={metrics === undefined ? "Loading…" : metrics.activeMarkets}
          detail="Tenant operating locations"
          tone="success"
        />
      </section>

      {/* Service state summary */}
      <section className="tenant-workspace-summary workspace-card">
        <div>
          <p className="eyebrow">Service state</p>
          <h2>Tenant control status</h2>
          <dl>
            <div>
              <dt>Subscription</dt>
              <dd>
                {tenantWorkspace.entitlement
                  ? `${tenantWorkspace.entitlement.planId} · ${tenantWorkspace.entitlement.status}`
                  : "Not configured"}
              </dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>
                {tenantWorkspace.tenant.country} · {tenantWorkspace.tenant.timezone}
              </dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{tenantWorkspace.tenant.currency}</dd>
            </div>
            <div>
              <dt>Scope proof</dt>
              <dd>
                <ShieldCheck size={15} aria-hidden="true" /> WorkOS membership
                required
              </dd>
            </div>
          </dl>
        </div>
        <div className="tenant-workspace-actions">
          <Link href="/subscribers" className="primary-button">
            Manage subscribers
          </Link>
          <Link href="/plans" className="secondary-button">
            Manage plans
          </Link>
        </div>
      </section>
    </div>
  );
}

function TenantWorkspaceSetup({ reason }: { reason: TenantWorkspaceSetupReason }) {
  const copy: Record<TenantWorkspaceSetupReason, { title: string; detail: string }> = {
    authentication_required: {
      title: "Sign in required",
      detail: "Sign in through WorkOS to open a tenant workspace.",
    },
    tenant_unconfigured: {
      title: "Tenant workspace is being set up",
      detail: "Your active WorkOS organization has not been registered as a MylesNet tenant yet. A platform administrator must complete verified tenant registration.",
    },
    tenant_unavailable: {
      title: "Tenant workspace is unavailable",
      detail: "This organization is not currently enabled for tenant operations. Contact your platform administrator.",
    },
    account_inactive: {
      title: "Your account is inactive",
      detail: "A platform administrator must reactivate your MylesNet account before the tenant workspace can be opened.",
    },
    tenant_membership_required: {
      title: "Tenant membership required",
      detail: "Your WorkOS organization is registered, but your tenant membership has not been activated yet.",
    },
  };
  const message = copy[reason];

  return (
    <div className="workspace-page">
      <section className="workspace-card tenant-workspace-summary" aria-live="polite">
        <p className="eyebrow">Tenant onboarding</p>
        <h1 className="page-title">{message.title}</h1>
        <p className="page-subtitle">{message.detail}</p>
      </section>
    </div>
  );
}
