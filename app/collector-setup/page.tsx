"use client";

import { useQuery } from "@/app/lib/convex";
import { Activity, Cog } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function relativeTime(timestamp: number | null): string {
  if (timestamp === null) return "never";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

type OnboardingStatuses = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.routers.getOnboardingStatuses>>>>;

function statusPill(status: string) {
  if (status === "live") return <span className="status-pill status-pill-success">Live</span>;
  if (status === "credentials_required") return <span className="status-pill status-pill-warning">Auth required</span>;
  if (status === "collector_failed") return <span className="status-pill status-pill-danger">Collector failing</span>;
  return <span className="status-pill status-pill-neutral">Collector pending</span>;
}

export default function CollectorSetupPage() {
  const routers = useQuery(api.routers.listRouters, {});
  const onboarding = useQuery(api.routers.getOnboardingStatuses);
  if (routers === undefined) {
    return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading collector setup…</div></div>;
  }
  const statuses = onboarding ?? [];
  return <div className="workspace-page"><header className="page-heading"><div><p className="eyebrow">Network operations · Monitoring</p><h1 className="page-title">Collector setup</h1><p className="page-subtitle">Run the collector alongside each router or a small Linux host on the LAN to gather RouterOS telemetry, DHCP leases, queues, events, and configuration snapshots into the dashboard.</p></div></header>
    <section className="workspace-card console-card"><div className="section-heading"><div><p className="eyebrow">Local install</p><h2>Run the collector</h2></div></div>
      <p className="console-note">Install Node.js 20+ on a machine that can reach both the router and the Convex deployment. Set the deployment URL and key below, export a router id per router, and start the collector. The default poll interval walks 15&nbsp;s; set <code>MYLESNET_COLLECTOR_INTERVAL_MS</code> to override.</p>
      <div className="collector-environment"><div><span>MYLESNET_CONVEX_URL</span><code>https://&lt;PROJECT&gt;.convex.cloud</code></div><div><span>MYLESNET_API_KEY</span><code>deployment key from project settings</code></div><div><span>MYLESNET_COLLECTOR_ROUTER_ID</span><code>router id from the table below</code></div><div><span>MYLESNET_COLLECTOR_INTERVAL_MS</span><code>optional · 15000 default</code></div><div><span>MYLESNET_ROUTER_HTTP_SKIP_TLS</span><code>optional · 1 to allow self-signed HTTPS</code></div></div>
      <pre className="json-viewer">{`npx convex deploy\nnpm run collector:local:check      # one poll per router, print outcome\nnpm run collector:start          # long-running loop with 15s interval`}</pre>
    </section>
    <section className="workspace-card console-card"><div className="section-heading"><div><p className="eyebrow">Per-router</p><h2>Router list</h2></div></div>
      {routers.length === 0 ? <p className="dialog-message">Register a router in Inventory first — every registered router gets a collector id.</p> : <div className="monitor-table monitor-table-2col"><div className="monitor-head"><span>Router</span><span>Collector</span></div>{routers.map((router) => <CollectorRow key={router._id} routerId={router._id} name={router.name} location={router.location} statuses={statuses} />)}</div>}
    </section>
  </div>;
}

function CollectorRow({ routerId, name, location, statuses }: { routerId: Id<"routers">; name: string; location: string; statuses: OnboardingStatuses }) {
  const status = statuses.find((entry) => entry.routerId === routerId);
  const lastTelemetry = status?.lastTelemetryAt ?? null;
  const lastCollectorRun = status?.collectorObservedAt ?? null;
  return <div className="monitor-row monitor-row-2col"><span><Link href={`/routers/${routerId}`} className="hover:text-orange-700"><strong>{name}</strong></Link><small>{location}</small></span><span className="monitor-cell-stack-a">
    <span className="monitor-cell-line"><Cog size={13} />Collector run <strong>{relativeTime(lastCollectorRun)}</strong></span>
    <span className="monitor-cell-line"><Activity size={13} />Last telemetry <strong>{relativeTime(lastTelemetry)}</strong></span>
    {status ? statusPill(status.status) : <span className="status-pill status-pill-neutral">Soon</span>}
  </span></div>;
}
