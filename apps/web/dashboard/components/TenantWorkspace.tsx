"use client";

import Link from "next/link";
import {
  Building2,
  DollarSign,
  Ticket,
  UsersRound,
} from "lucide-react";
import { useQuery } from "@/app/lib/convex";
import { tenantControl } from "@/lib/convex/tenantControl";
import { dashboard } from "@/shared/convex/dashboard";
import MetricCard from "@/shared/components/MetricCard";
import { openControlCentre } from "@/shared/auth/workspace-actions";

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
    return <TenantWorkspaceSetup />;
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
          <p className="page-subtitle">Your operational workspace.</p>
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

      <section className="tenant-workspace-summary workspace-card">
        <div>
          <p className="eyebrow">Workspace details</p>
          <h2>Operations at a glance</h2>
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
              <dt>Access</dt>
              <dd>
                Active team member
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

function TenantWorkspaceSetup() {
  return (
    <div className="workspace-page">
      <section className="workspace-card tenant-workspace-summary" aria-live="polite">
        <p className="eyebrow">Workspace</p>
        <div>
          <h1 className="page-title">Your workspace is nearly ready</h1>
          <p className="page-subtitle">Continue in the control centre while the workspace is prepared.</p>
        </div>
        <form action={openControlCentre}>
          <button type="submit" className="primary-button">
            Open control centre
          </button>
        </form>
      </section>
    </div>
  );
}
