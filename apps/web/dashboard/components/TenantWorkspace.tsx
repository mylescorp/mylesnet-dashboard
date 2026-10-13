"use client";

import Link from "next/link";
import {
  CheckCircle2,
  Network,
  Ticket,
  UsersRound,
} from "lucide-react";
import { ActionCard, ActivityList, InsetPanel, LiveStrip, Skeleton, StatCard } from "@mylesnet/ui";
import { useQuery } from "@/app/lib/convex";
import { tenantControl } from "@/lib/convex/tenantControl";
import { dashboard } from "@/shared/convex/dashboard";
import { networkOps } from "@/shared/convex/networkOps";
import { openControlCentre } from "@/shared/auth/workspace-actions";

const n = (v: number) => v.toLocaleString("en", { maximumFractionDigits: 2 });
const money = (currency: string, value: number) => `${currency === "UGX" ? "USh" : currency} ${n(value)}`;

function partOfDay(timezone: string): string {
  try {
    const hour = Number(
      new Intl.DateTimeFormat("en", { hour: "numeric", hourCycle: "h23", timeZone: timezone }).format(
        new Date(),
      ),
    );
    if (hour < 5) return "Good night";
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  } catch {
    return "Welcome";
  }
}

export function TenantWorkspace() {
  const workspace = useQuery(tenantControl.getCurrentWorkspace, {});
  const metrics = useQuery(dashboard.getMetrics, workspace?.status === "ready" ? {} : "skip");
  const setup = useQuery(dashboard.getSetupStatus, workspace?.status === "ready" ? {} : "skip");
  const live = useQuery(networkOps.listLiveSessions, workspace?.status === "ready" ? {} : "skip");

  if (workspace === undefined)
    return (
      <div className="workspace-page mn-overview-loading" aria-label="Loading tenant overview">
        <Skeleton variant="card" />
        <Skeleton variant="card" />
        <Skeleton variant="card" />
      </div>
    );

  if (workspace.status === "setup_required") {
    return <TenantWorkspaceSetup suspended={workspace.reason === "tenant_suspended"} />;
  }

  const tenantWorkspace = workspace.workspace;
  const greeting = setup
    ? `${partOfDay(tenantWorkspace.tenant.timezone)}${setup.firstName ? `, ${setup.firstName}` : ""}`
    : "Welcome";
  const pendingActions = setup?.items.filter((item) => !item.done) ?? [];
  const liveSessions = live?.sessions ?? [];

  return (
    <div className="workspace-page tenant-workspace-page mn-overview">
      <section className="mn-overview-hero workspace-card">
        <div>
          <p className="mn-eyebrow">{metrics === undefined ? "Tenant overview" : `${metrics.activeSubscriptions} active subscriptions`}</p>
          <h1><span>{greeting}</span>{greeting !== "Welcome" ? "," : ""} <strong>{tenantWorkspace.tenant.name}</strong></h1>
          <p className="mn-overview-summary">
            {metrics ? <><b>{money(metrics.currency, metrics.revenueToday)}</b> collected today across <b>{metrics.revenueTodayCount}</b> completed payments.</> : "Workspace activity and service health at a glance."}
          </p>
          <p className="mn-overview-helper">{setup && setup.completedSteps === setup.totalSteps ? "Your workspace is ready for the day." : "Your network activity, in one calm view."}</p>
        </div>
        <div className="mn-overview-hero-actions">
          <Link href="/subscribers" className="secondary-button">View subscribers</Link>
          <Link href="/network" className="secondary-button">Network activity</Link>
        </div>
      </section>

      <LiveStrip
        liveLabel="LIVE"
        event={live === undefined ? "Checking subscriber service periods" : `${live.stats.totalLive} subscribers within their service period`}
        health={`Workspace ${tenantWorkspace.tenant.status}`}
      />

      <section className="mn-overview-stats" aria-label="Today's key metrics">
        <StatCard label="Revenue today" value={metrics ? money(metrics.currency, metrics.revenueToday) : <Skeleton variant="title" />} caption={metrics ? `${metrics.revenueTodayCount} completed payments` : "Loading current revenue"} />
        <StatCard label="Active subscriptions" value={metrics?.activeSubscriptions ?? <Skeleton variant="title" />} caption="Subscriptions valid today" />
        <StatCard label="New signups" value={metrics?.newSignupsToday ?? <Skeleton variant="title" />} caption="Subscribers added today" />
      </section>

      <div className="mn-overview-lower">
        <InsetPanel title="Subscribers in service period" actions={<span className="sidebar-count">{liveSessions.length}</span>}>
          {live === undefined ? <Skeleton variant="card" /> : liveSessions.length > 0 ? (
            <ActivityList label="Subscribers within their service period" items={liveSessions.slice(0, 5).map((session) => ({
              id: session.id,
              icon: <Network size={17} aria-hidden="true" />,
              title: session.name,
              detail: session.plan?.name ?? session.connectionType,
              timestamp: "In service",
              href: "/network",
            }))} />
          ) : (
            <div className="mn-overview-empty">
              <p>No subscribers are within their service period right now.</p>
              <Link href="/subscribers">Manage subscribers</Link>
            </div>
          )}
        </InsetPanel>
        <InsetPanel title="What's next" actions={pendingActions.length > 0 ? <span className="sidebar-count">{pendingActions.length}</span> : null}>
          <div className="mn-overview-actions">
            {pendingActions.length > 0 ? pendingActions.slice(0, 4).map((item) => (
              <ActionCard key={item.key} icon={<CheckCircle2 size={17} aria-hidden="true" />} title={item.label} description="Continue setting up your workspace" href={item.href} />
            )) : (
              <ActionCard icon={<UsersRound size={17} aria-hidden="true" />} title="Manage subscribers" description="Review your subscriber directory" href="/subscribers" />
            )}
            {metrics && metrics.openTickets > 0 ? <ActionCard icon={<Ticket size={17} aria-hidden="true" />} title={`${metrics.openTickets} open support tickets`} description="Review the support queue" href="/tickets" /> : null}
          </div>
        </InsetPanel>
      </div>

      <section className="mn-overview-details workspace-card">
        <div><p className="mn-eyebrow">Workspace details</p><h2>{tenantWorkspace.tenant.name}</h2></div>
        <dl>
          <div><dt>Region</dt><dd>{tenantWorkspace.tenant.country} · {tenantWorkspace.tenant.timezone}</dd></div>
          <div><dt>Currency</dt><dd>{tenantWorkspace.tenant.currency}</dd></div>
          <div><dt>Sites</dt><dd>{metrics?.activeMarkets ?? "Loading"}</dd></div>
          <div><dt>Subscription</dt><dd>{tenantWorkspace.entitlement ? tenantWorkspace.entitlement.status : "Not configured"}</dd></div>
        </dl>
      </section>
    </div>
  );
}

function TenantWorkspaceSetup({ suspended = false }: { suspended?: boolean }) {
  return (
    <div className="workspace-page">
      <section className="workspace-card tenant-workspace-summary" aria-live="polite">
        <p className="eyebrow">Workspace</p>
        <div>
          <h1 className="page-title">{suspended ? "Workspace access is suspended" : "Your workspace is nearly ready"}</h1>
          <p className="page-subtitle">{suspended ? "This organization is temporarily unavailable. Contact your service provider for help." : "Continue in the control centre while the workspace is prepared."}</p>
        </div>
        {!suspended ? <form action={openControlCentre}>
          <button type="submit" className="primary-button">Open control centre</button>
        </form> : null}
      </section>
    </div>
  );
}
