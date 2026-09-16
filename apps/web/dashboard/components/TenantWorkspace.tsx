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
import { tenantControl } from "@/lib/convex/tenantControl";
import MetricCard from "@/shared/components/MetricCard";

export function TenantWorkspace() {
  const workspace = useQuery(tenantControl.getCurrentWorkspace, {});
  if (workspace === undefined)
    return (
      <div className="workspace-page">
        <div className="loading-panel workspace-card">
          Loading tenant workspace…
        </div>
      </div>
    );

  const newSignups = 0;

  return (
    <div className="workspace-page tenant-workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Tenant workspace</p>
          <h1 className="page-title">{workspace.tenant.name}</h1>
          <p className="page-subtitle">
            Your operational workspace is bound to your active WorkOS
            organization membership. No tenant can be selected from the browser.
          </p>
        </div>
        <span
          className={`status-pill status-pill-${workspace.tenant.status === "active" ? "success" : workspace.tenant.status === "suspended" ? "danger" : "warning"}`}
        >
          {workspace.tenant.status}
        </span>
      </header>

      <section className="metric-grid">
        <MetricCard
          icon={DollarSign}
          label="Revenue today"
          value="KES 0"
          detail="Today's payments"
          tone="primary"
        />
        <MetricCard
          icon={UsersRound}
          label="Active subscriptions"
          value={workspace.activeMembers}
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
          value="—"
          detail="Support queue is available from Tickets"
          tone="neutral"
        />
        <MetricCard
          icon={Building2}
          label="Active sites"
          value={workspace.activeMarkets}
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
                {workspace.entitlement
                  ? `${workspace.entitlement.planId} · ${workspace.entitlement.status}`
                  : "Not configured"}
              </dd>
            </div>
            <div>
              <dt>Region</dt>
              <dd>
                {workspace.tenant.country} · {workspace.tenant.timezone}
              </dd>
            </div>
            <div>
              <dt>Currency</dt>
              <dd>{workspace.tenant.currency}</dd>
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
