"use client";

import { useQuery } from "@/app/lib/convex";
import { Activity, AlertTriangle, CheckCircle2, Cog, ExternalLink, HeartPulse, RadioTower, Router, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { HealthGuardQuickActions } from "@/app/components/router/HealthGuardQuickActions";

function relativeTime(timestamp: number | null): string {
  if (timestamp === null) return "never";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

type OnboardingStatuses = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.routers.getOnboardingStatuses>>>>;
type RouterRow = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.routers.listRouters>>>>[number];
type HealthguardState = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.deviceCommands.listAllRouterHealthguardStates>>>>[number];

function statusPill(status: string) {
  if (status === "live") return <span className="status-pill status-pill-success">Live</span>;
  if (status === "credentials_required") return <span className="status-pill status-pill-warning">Auth required</span>;
  if (status === "collector_failed") return <span className="status-pill status-pill-danger">Collector failing</span>;
  return <span className="status-pill status-pill-neutral">Collector pending</span>;
}

function FleetStat({ icon, label, value, tone }: { icon: React.ReactNode; label: string; value: number; tone?: "warning" | "danger" }) {
  return <div className={`fleet-stat${tone ? ` fleet-stat-${tone}` : ""}`}><span className="fleet-stat-icon">{icon}</span><span className="fleet-stat-copy"><b>{value}</b><span>{label}</span></span></div>;
}

function MetricLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return <span className="fleet-metric">{icon}<span className="fleet-metric-copy"><span>{label}</span><b>{value}</b></span></span>;
}

export default function CollectorSetupPage() {
  const routers = useQuery(api.routers.listRouters, {});
  const onboarding = useQuery(api.routers.getOnboardingStatuses);
  const healthguardStates = useQuery(api.deviceCommands.listAllRouterHealthguardStates, {});
  const currentUser = useQuery(api.platform.getCurrentPlatformUser, {});
  if (routers === undefined || healthguardStates === undefined || currentUser === undefined) {
    return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading collector setup…</div></div>;
  }
  const statuses = onboarding ?? [];
  const states = healthguardStates as HealthguardState[];
  const canManage = currentUser?.permissions?.includes("routers:manage") ?? false;

  const stateByRouter = new Map<Id<"routers">, HealthguardState>();
  for (const state of states) stateByRouter.set(state.routerId, state);
  const reportingCount = states.filter((state) => !state.stale).length;
  const staleCount = states.length - reportingCount;
  const wwwSslDown = states.filter((state) => state.wwwSslEnabled === false).length;

  return <div className="workspace-page"><header className="page-heading"><div><p className="eyebrow">Network operations · Monitoring</p><h1 className="page-title">Collector setup</h1><p className="page-subtitle">One collector loop per router gathers RouterOS telemetry, DHCP leases, queues, events, and configuration snapshots. Manage commands and deployment from a single fleet view.</p></div></header>

    <section className="workspace-card console-card fleet-panel">
      <div className="section-heading">
        <div><p className="eyebrow">Self-healing controls</p><h2><HeartPulse size={18} aria-hidden="true" /> HealthGuard fleet</h2></div>
        <span className={`status-pill ${staleCount > 0 ? "status-pill-warning" : "status-pill-success"}`}><ShieldCheck size={13} />{staleCount > 0 ? `${staleCount} collector${staleCount === 1 ? "" : "s"} stale` : "All collectors reporting"}</span>
      </div>
      <p className="console-note">Each row shows the collector status and one-click commands queued for that router&apos;s next check-in: re-enable the www-ssl service if it dropped, or restart the collector process. Read-only — commands never touch billing or router traffic.</p>

      <div className="fleet-summary">
        <FleetStat icon={<Router size={18} />} label="Routers monitored" value={states.length} />
        <FleetStat icon={<CheckCircle2 size={18} />} label="Reporting now" value={reportingCount} tone={staleCount === 0 ? undefined : "warning"} />
        <FleetStat icon={<AlertTriangle size={18} />} label="Stale collectors" value={staleCount} tone={staleCount > 0 ? "danger" : undefined} />
        <FleetStat icon={<ShieldCheck size={18} />} label="www-ssl down" value={wwwSslDown} tone={wwwSslDown > 0 ? "danger" : undefined} />
      </div>

      {states.length === 0 ? <div className="collector-setup-empty">No routers registered — add one from the Router estate page first.</div> : <div className="fleet-list">{states.map((state) => <FleetRow key={state.routerId} routerId={state.routerId} state={state} router={routers.find((entry) => entry._id === state.routerId)} statuses={statuses} canManage={canManage} />)}</div>}
    </section>

    <div className="settings-grid collector-guide-grid">
      <section className="workspace-card console-card">
        <div className="section-heading"><div><p className="eyebrow">Local install</p><h2>Run the collector</h2></div></div>
        <p className="console-note">Install Node.js 20+ on a machine that can reach both the router and the Convex deployment, export a router id per router, and start the loop. The default poll interval is 15&nbsp;s; override with <code>MYLESNET_COLLECTOR_INTERVAL_MS</code>.</p>
        <div className="collector-environment"><div><span>MYLESNET_CONVEX_URL</span><code>https://&lt;PROJECT&gt;.convex.cloud</code></div><div><span>MYLESNET_API_KEY</span><code>deployment key from project settings</code></div><div><span>MYLESNET_COLLECTOR_ROUTER_ID</span><code>router id from the fleet above</code></div><div><span>MYLESNET_COLLECTOR_INTERVAL_MS</span><code>optional · 15000 default</code></div><div><span>MYLESNET_ROUTER_HTTP_SKIP_TLS</span><code>optional · 1 to allow self-signed HTTPS</code></div></div>
        <pre className="json-viewer">{`npx convex deploy\nnpm run collector:local:check      # one poll per router, print outcome\nnpm run collector:start          # long-running loop with 15s interval`}</pre>
      </section>

      <section className="workspace-card console-card">
        <div className="section-heading"><div><p className="eyebrow">Getting started</p><h2>Deploy walkthrough</h2></div></div>
        <ol className="collector-guide">
          <li><span><Cog size={15} /></span><div><strong>Register the router</strong><small>Add it from the Router estate page — every registered router gets a collector id.</small></div></li>
          <li><span><ShieldCheck size={15} /></span><div><strong>Set credentials</strong><small>Store read-only RouterOS credentials in the router&apos;s Edit settings panel. The collector never exposes them to the browser.</small></div></li>
          <li><span><RadioTower size={15} /></span><div><strong>Start the collector</strong><small>Run <code>npm run collector:start</code> near the router, then watch this fleet return to <b>Reporting</b>.</small></div></li>
        </ol>
        <Link href="/routers" className="pf-button"><ExternalLink size={15} />Open router estate</Link>
      </section>
    </div>
  </div>;
}

function FleetRow({ routerId, state, router, statuses, canManage }: { routerId: Id<"routers">; state: HealthguardState; router: RouterRow | undefined; statuses: OnboardingStatuses; canManage: boolean }) {
  const status = statuses.find((entry) => entry.routerId === routerId);
  const lastCollectorRun = status?.collectorObservedAt ?? null;
  const lastTelemetry = status?.lastTelemetryAt ?? null;
  const name = router?.name ?? state.routerName;
  const location = router?.location ?? "Unmanaged";
  return <div className="fleet-row">
    <div className="fleet-router">
      <span className="fleet-avatar" aria-hidden="true">{name.trim().charAt(0).toUpperCase() || "R"}</span>
      <div className="fleet-router-copy">
        <Link href={`/routers/${routerId}`}><strong>{name}</strong></Link>
        <span>{location}</span>
      </div>
    </div>
    <div className="fleet-health">
      <div className="fleet-status-tags">{status ? statusPill(status.status) : <span className="status-pill status-pill-neutral">Collector pending</span>}{state.stale ? <span className="status-pill status-pill-warning">Stale</span> : state.lastRunAt ? <span className="status-pill status-pill-success">Reporting</span> : null}</div>
      <div className="fleet-metric-list">
        <MetricLine icon={<Cog size={13} />} label="Collector run" value={relativeTime(lastCollectorRun)} />
        <MetricLine icon={<Activity size={13} />} label="Last telemetry" value={relativeTime(lastTelemetry)} />
      </div>
    </div>
    <div className="fleet-actions"><HealthGuardQuickActions routerId={routerId} state={state} canManage={canManage} hideMeta /></div>
  </div>;
}