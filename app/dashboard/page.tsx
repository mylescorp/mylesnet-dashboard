"use client";

import { useQuery } from "convex/react";
import { Activity, AlertTriangle, ArrowUpRight, BarChart3, Boxes, CircleDollarSign, FileDiff, Gauge, RadioTower, SlidersHorizontal, Spline, Timer, Users, Wifi } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { HealthTrendChart } from "../components/HealthTrendChart";
import BillingKpiStrip from "../components/BillingKpiStrip";
import { useUserProfile } from "../components/UserProfileContext";

const bytes = (value: number) => value < 1024 ? `${Math.round(value)} B` : value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB` : value < 1024 ** 3 ? `${(value / 1024 ** 2).toFixed(1)} MB` : `${(value / 1024 ** 3).toFixed(2)} GB`;
const rate = (value: number) => `${bytes(value)}/s`;
const relativeTime = (timestamp: number) => {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 5_000) return "just now";
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
};

function uptimeLabel(uptimeMs: number): string {
  return relativeTime(Math.max(0, Date.now() - uptimeMs));
}

function isCollectorFresh(observedAt: number | undefined): boolean {
  return observedAt !== undefined && Date.now() - observedAt < 60_000;
}

export default function DashboardPage() {
  const router = useRouter();
  const kpis = useQuery(api.operations.getKpis, {});
  const summaries = useQuery(api.operations.getRouterSummaries, {});
  const { user } = useUserProfile();
  const isPlatformUser = user?.isPlatform === true;
  const [selectedRouterId, setSelectedRouterId] = useState<Id<"routers"> | null>(null);
  const [selectedAccessPoint, setSelectedAccessPoint] = useState<{ id: Id<"accessPoints">; name: string } | null>(null);
  const [detailRouterId, setDetailRouterId] = useState<Id<"routers"> | null>(null);
  const [compact, setCompact] = useState(false);
  const accessPointUsers = useQuery(api.operations.getAccessPointUsers, selectedAccessPoint?.id ? { accessPointId: selectedAccessPoint.id } : "skip");

  if (!kpis || !summaries) return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading the operational overview…</div></div>;

  const visibleRouters = summaries.filter((entry) => !selectedRouterId || entry._id === selectedRouterId);
  const detailRouter = summaries.find((entry) => entry._id === detailRouterId) ?? null;
  const healthStatus = kpis.healthScore === null ? "Awaiting telemetry" : kpis.healthScore === 100 ? "Healthy" : "Needs attention";

  return <div className={`workspace-page dashboard-page ${compact ? "dashboard-compact" : ""}`}>
    <header className="page-heading">
      <div><p className="eyebrow">MylesNet operations centre</p><h1 className="page-title">Dashboard</h1><p className="page-subtitle">One place for live network telemetry, billing activity and administrative status.</p></div>
      <div className="page-action-group"><Link href="/config-watch" className="secondary-button"><FileDiff aria-hidden="true" size={16} />Config watch</Link><Link href="/telemetry-health" className="secondary-button"><Activity aria-hidden="true" size={16} />Telemetry health</Link><Link href="/business-activity" className="secondary-button"><BarChart3 aria-hidden="true" size={16} />Business activity</Link><button type="button" className="secondary-button" onClick={() => setCompact((value) => !value)}><SlidersHorizontal aria-hidden="true" size={17} />{compact ? "Comfortable view" : "Compact view"}</button><button type="button" onClick={() => router.push("/routers")} className="primary-button"><RadioTower aria-hidden="true" size={18} />Router settings</button></div>
    </header>

    <section className="operations-kpi-strip" aria-label="Live operations status">
      <Kpi label="Collector status" value={kpis.collectorConnected ? "Connected" : kpis.collectorStatus === "failed" ? "Needs attention" : "Awaiting data"} detail={kpis.collectorStatus === "failed" ? (kpis.collectorStatusMessage ?? "The last collector run failed.") : kpis.lastObservedAt ? `Last observation ${new Date(kpis.lastObservedAt).toLocaleTimeString()}` : "No collector observation received"} icon={<Activity size={17} />} />
      <Kpi label="Network health" value={healthStatus} detail={kpis.healthScore === null ? "No router telemetry" : `${kpis.healthScore}% of routers reporting live telemetry`} icon={<Gauge size={17} />} />
      <Kpi label="Live users" value={kpis.totalUsers} detail="Current hotspot sessions" icon={<Users size={17} />} />
      <Kpi label="Access points" value={`${kpis.activeAccessPoints}/${kpis.totalAccessPoints}`} detail="Links currently online" icon={<Wifi size={17} />} />
      <Kpi label="Data used" value={bytes(kpis.totalDailyBytes)} detail="Observed in the last 24 hours" icon={<BarChart3 size={17} />} />
      <Kpi label="Router load" value={kpis.averageCpu === null ? "—" : `${Math.round(kpis.averageCpu)}% CPU`} detail="Average reported router CPU load" icon={<Gauge size={17} />} />
    </section>

    <section className="section-block" aria-label="Billing and business summary">
      <div className="section-heading"><div><p className="eyebrow">Billing &amp; business</p><h2>Centipid activity</h2></div><div className="page-action-group"><Link href="/business-activity" className="secondary-button"><BarChart3 aria-hidden="true" size={15} />Full activity feed</Link></div></div>
      <BillingKpiStrip />
    </section>

    <section className="dashboard-toolbar workspace-card">
      <div><span className="toolbar-label">Operational scope</span><strong>Filter the operational view to a single router, or review the complete estate.</strong></div>
      <label className="router-select-label">Router<select value={selectedRouterId ?? ""} onChange={(event) => { setSelectedRouterId(event.target.value ? (event.target.value as Id<"routers">) : null); setDetailRouterId(null); }}><option value="">All routers</option>{summaries.map((entry) => <option key={entry._id} value={entry._id}>{entry.name} · {entry.location}</option>)}</select></label>
    </section>

    <OpsHealthStrip />

    {visibleRouters.length ? visibleRouters.map((entry) => <RouterSection key={entry._id} routerId={entry._id} showChart={visibleRouters.length === 1} onOpenDetail={() => setDetailRouterId(entry._id)} onViewUsers={setSelectedAccessPoint} />) : <Empty title="No routers are registered" detail="Add a router record from Router settings, deploy the backend with npx convex deploy, then run the collector so live telemetry appears here." action={() => router.push("/routers")} label="Manage routers" />}

    {detailRouter ? <RouterDetailDialog routerId={detailRouter._id} routerName={detailRouter.name} onClose={() => setDetailRouterId(null)} /> : null}
    {selectedAccessPoint ? <AccessPointUsersDialog title={selectedAccessPoint.name} users={accessPointUsers} onClose={() => setSelectedAccessPoint(null)} /> : null}
    {selectedRouterId ? <section className="section-block" aria-label="Trends for the selected router"><HealthTrendChart routerId={selectedRouterId} /></section> : null}

    {isPlatformUser ? <AdminOverviewSection /> : null}
  </div>;
}

function Kpi({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) { return <article className="operations-kpi"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>; }
function Sparkline({ points }: { points: number[] }) { const max = Math.max(...points, 1); const coordinates = points.length < 2 ? "0,34 100,34" : points.map((point, index) => `${(index / (points.length - 1)) * 100},${34 - (point / max) * 28}`).join(" "); return <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-label="Recent traffic trend" role="img"><polyline points={coordinates} /></svg>; }
function Empty({ title, detail, action, label }: { title: string; detail: string; action: () => void; label: string }) { return <div className="empty-state workspace-card"><h3>{title}</h3><p>{detail}</p><button type="button" className="primary-button" onClick={action}>{label}</button></div>; }
function AccessPointUsersDialog({ title, users, onClose }: { title: string; users: { _id: Id<"activeHotspotSessions">; subscriberIdentifier: string; observedAt: number; observedBytes: number }[] | undefined; onClose: () => void }) { return <div className="operations-modal" role="dialog" aria-modal="true" aria-label={`${title} users`}><div className="operations-dialog workspace-card"><div className="section-heading"><div><p className="eyebrow">Live hotspot users</p><h2>{title}</h2></div><button type="button" className="secondary-button" onClick={onClose}>Close</button></div>{users === undefined ? <p className="dialog-message">Loading current hotspot sessions…</p> : users.length === 0 ? <p className="dialog-message">No active hotspot sessions are currently mapped to this access point.</p> : <div className="session-list">{users.map((user) => <div key={user._id}><strong>{user.subscriberIdentifier}</strong><span>Observed {new Date(user.observedAt).toLocaleTimeString()} · {bytes(user.observedBytes)}</span></div>)}</div>}</div></div>; }

function RouterSection({ routerId, showChart, onOpenDetail, onViewUsers }: { routerId: Id<"routers">; showChart: boolean; onOpenDetail: () => void; onViewUsers: (target: { id: Id<"accessPoints">; name: string }) => void }) {
  const nav = useRouter();
  const live = useQuery(api.operations.getLiveRouter, { routerId });
  const [showComparison, setShowComparison] = useState(false);
  if (!live) return <section className="section-block"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={20} />Loading router telemetry…</div></section>;

  const accessPoints = live.accessPoints.map((entry) => ({ ...entry, router: live.router }));
  const collectorFresh = isCollectorFresh(live.collector?.observedAt);

  return <section className="section-block router-section">
    <div className="section-heading"><div><p className="eyebrow">Router · {live.router.location}</p><h2>{live.router.name}</h2></div><div className="page-action-group"><button type="button" className="secondary-button" onClick={onOpenDetail}>Telemetry & leases <Spline aria-hidden="true" size={15} /></button><button type="button" className="secondary-button" onClick={() => setShowComparison(true)} disabled={accessPoints.length < 2}>Compare APs <ArrowUpRight aria-hidden="true" size={16} /></button></div></div>

    <div className="router-health-strip">
      <CollectorHealthCard collector={live.collector} fresh={collectorFresh} />
      <div className="workspace-card upstream-card"><p className="eyebrow">Upstream health</p><h2>Route observation</h2><div className="upstream-list"><div><span className={`status-dot ${live.upstream.configured ? "status-dot-online" : "status-dot-warning"}`} /><p><strong>{live.router.name}</strong><small>{live.upstream.configured ? "A default route is present in the most recent collector snapshot." : "No current default-route observation has been received."}</small></p></div></div></div>
      {live.telemetry ? <div className="workspace-card telemetry-card"><p className="eyebrow">Device telemetry</p><h2>{live.telemetry.identity ?? live.router.name}</h2><dl className="access-point-stats"><div><dt>Temp</dt><dd>{live.telemetry.systemHealth?.temperature !== undefined ? `${live.telemetry.systemHealth.temperature}${live.telemetry.systemHealth.temperatureUnit ?? "°"}` : "—"}</dd></div><div><dt>Voltage</dt><dd>{live.telemetry.systemHealth?.voltage !== undefined ? `${live.telemetry.systemHealth.voltage} V` : "—"}</dd></div><div><dt>Ethernet links</dt><dd>{live.telemetry.ethernetPorts?.filter((port) => port.running).length ?? 0}/{live.telemetry.ethernetPorts?.length ?? 0} up</dd></div><div><dt>WiFi radios</dt><dd>{live.telemetry.wifiRadios?.filter((radio) => radio.state === "running").length ?? 0}/{live.telemetry.wifiRadios?.length ?? 0} on air</dd></div></dl></div> : null}
    </div>

    {accessPoints.length ? <div className="access-point-grid access-point-grid-rich">{accessPoints.map(({ accessPoint, health, activeUserCount, dailyBytes, trafficTrend }) => {
      const capacity = accessPoint.capacity;
      const capacityPercent = capacity && capacity > 0 ? Math.min(100, (activeUserCount / capacity) * 100) : null;
      return <article key={accessPoint._id} className="access-point-card workspace-card"><div className="access-point-head"><div><h3>{accessPoint.name}</h3><p>{accessPoint.port} · {live.router.name}</p></div><span className={`status-pill ${health?.linkState ? "status-pill-success" : "status-pill-warning"}`}>{health?.linkState ? "Running" : "Awaiting telemetry"}</span></div>
        <div className="ap-user-row"><span><Users aria-hidden="true" size={15} />Users</span><strong>{activeUserCount}</strong></div>
        <div className="ap-traffic"><span>Current speed</span><strong>↓ {rate(health?.rxBytesPerSec ?? 0)} · ↑ {rate(health?.txBytesPerSec ?? 0)}</strong><Sparkline points={trafficTrend.map((point) => point.bytesPerSecond)} /></div>
        <dl className="access-point-stats"><div><dt>Health</dt><dd>{health?.linkState ? "Good" : "Pending"}</dd></div><div><dt>Rate limit</dt><dd>{accessPoint.rateLimitReference ?? "Not configured"}</dd></div><div><dt>Data used</dt><dd>{bytes(dailyBytes)}</dd></div><div><dt>Errors / drops</dt><dd>{(health?.errorCount ?? 0) + (health?.queueDrops ?? 0)}</dd></div></dl>
        <div className="ap-capacity"><div><span>Capacity</span><strong>{capacity ? `${activeUserCount} / ${capacity} users` : "Not configured"}</strong></div>{capacityPercent !== null ? <i><b style={{ width: `${capacityPercent}%` }} /></i> : null}</div>
        <div className="access-point-actions"><button type="button" className="secondary-button" onClick={() => onViewUsers({ id: accessPoint._id, name: accessPoint.name })}>View users</button><button type="button" className="primary-button" onClick={onOpenDetail}>Details</button></div>
      </article>;
    }) }</div> : <><RouterLivePanel live={live} /><div className="access-point-actions"><button type="button" className="secondary-button" onClick={() => nav.push("/routers")}>Register access points</button><span className="console-note">Router telemetry shows live data even before access point records are registered. Add records from Router settings to map users and traffic per link.</span></div></>}

    {showComparison ? <ComparisonDialog accessPoints={accessPoints} onClose={() => setShowComparison(false)} /> : null}
    {showChart ? <HealthTrendChart routerId={routerId} /> : null}
  </section>;
}

function CollectorHealthCard({ collector, fresh }: { collector: { observedAt: number; status: "connected" | "failed"; message?: string; latencyMs?: number; consecutiveFailures?: number; processUptimeMs?: number } | null; fresh: boolean }) {
  return <div className={`workspace-card collector-card ${collector?.status === "failed" ? "collector-card-failed" : ""}`}>
    <div className="collector-card-head"><p className="eyebrow">Collector health</p><span className={`status-pill ${fresh ? "status-pill-success" : collector?.status === "failed" ? "status-pill-danger" : "status-pill-warning"}`}>{fresh ? "Connected" : collector?.status === "failed" ? "Failed" : "Stale"}</span></div>
    <dl className="access-point-stats">
      <div><dt><Timer aria-hidden="true" size={13} /> Last run</dt><dd>{collector ? relativeTime(collector.observedAt) : "Never"}</dd></div>
      <div><dt>Round-trip</dt><dd>{collector?.latencyMs !== undefined ? `${Math.round(collector.latencyMs)} ms` : "—"}</dd></div>
      <div><dt>Consecutive failures</dt><dd>{collector?.consecutiveFailures ?? 0}</dd></div>
      <div><dt>Process uptime</dt><dd>{collector?.processUptimeMs !== undefined ? uptimeLabel(collector.processUptimeMs) : "—"}</dd></div>
    </dl>
    {collector?.message ? <p className="collector-card-message">{collector.message}</p> : collector === null ? <p className="collector-card-message">No collector run recorded for this router yet. Deploy the backend with <code>npx convex deploy</code>, then follow the Collector setup steps to poll the RouterOS API.</p> : null}
  </div>;
}

function RouterLivePanel({ live }: { live: { hotspotSessions: { subscriberIdentifier: string; observedBytes: number; observedAt: number }[]; leaseCount: number; queueCount: number; latestHealth: { cpuPercent: number; memoryPercent: number; txBytesPerSec: number; rxBytesPerSec: number; timestamp: number } | null; telemetry: { ethernetPorts?: { name: string; running?: boolean }[]; wifiRadios?: { interfaceName: string; state?: string }[] } | null } }) {
  return <div className="access-point-grid access-point-grid-rich">
    <article className="access-point-card workspace-card">
      <div className="access-point-head"><div><h3>Live hotspot users</h3><p>Current sessions on the router</p></div><span className={`status-pill ${live.hotspotSessions.length ? "status-pill-success" : "status-pill-warning"}`}>{live.hotspotSessions.length ? "Active" : "Idle"}</span></div>
      <div className="ap-user-row"><span><Users aria-hidden="true" size={15} />Users</span><strong>{live.hotspotSessions.length}</strong></div>
      {live.hotspotSessions.length ? <div className="session-list">{live.hotspotSessions.slice(0, 6).map((session) => <div key={session.subscriberIdentifier}><strong>{session.subscriberIdentifier}</strong><span>Observed {relativeTime(session.observedAt)} · {bytes(session.observedBytes)}</span></div>)}</div> : <p className="dialog-message">No active hotspot sessions on the router.</p>}
    </article>
    <article className="access-point-card workspace-card">
      <div className="access-point-head"><div><h3>Router in numbers</h3><p>Latest collector snapshot</p></div><span className={`status-pill ${live.latestHealth ? "status-pill-success" : "status-pill-warning"}`}>{live.latestHealth ? "Live" : "Awaiting telemetry"}</span></div>
      <dl className="access-point-stats">
        <div><dt>CPU</dt><dd>{live.latestHealth ? `${Math.round(live.latestHealth.cpuPercent)}%` : "—"}</dd></div>
        <div><dt>Memory</dt><dd>{live.latestHealth ? `${Math.round(live.latestHealth.memoryPercent)}%` : "—"}</dd></div>
        <div><dt>Throughput</dt><dd>↓ {rate(live.latestHealth?.rxBytesPerSec ?? 0)} · ↑ {rate(live.latestHealth?.txBytesPerSec ?? 0)}</dd></div>
        <div><dt>DHCP leases</dt><dd>{live.leaseCount}</dd></div>
        <div><dt>Simple queues</dt><dd>{live.queueCount}</dd></div>
        <div><dt>Ethernet links</dt><dd>{live.telemetry?.ethernetPorts ? `${live.telemetry.ethernetPorts.filter((port) => port.running).length}/${live.telemetry.ethernetPorts.length} up` : "—"}</dd></div>
      </dl>
    </article>
  </div>;
}

function RouterDetailDialog({ routerId, routerName, onClose }: { routerId: Id<"routers">; routerName: string; onClose: () => void }) {
  const leases = useQuery(api.operations.getDhcpLeases, { routerId });
  const queues = useQuery(api.operations.getSimpleQueues, { routerId });
  const telemetry = useQuery(api.operations.getRouterTelemetryLatest, { routerId });
  return <div className="operations-modal" role="dialog" aria-modal="true" aria-label={`${routerName} telemetry`}>
    <div className="operations-dialog operations-dialog-wide workspace-card">
      <div className="section-heading"><div><p className="eyebrow">Router detail</p><h2>{routerName}</h2></div><button type="button" className="secondary-button" onClick={onClose}>Close</button></div>
      {telemetry ? <dl className="access-point-stats"><div><dt>Identity</dt><dd>{telemetry.identity ?? "—"}</dd></div><div><dt>Temperature</dt><dd>{telemetry.systemHealth?.temperature !== undefined ? `${telemetry.systemHealth.temperature}${telemetry.systemHealth.temperatureUnit ?? "°"}` : "—"}</dd></div><div><dt>Voltage</dt><dd>{telemetry.systemHealth?.voltage !== undefined ? `${telemetry.systemHealth.voltage} V` : "—"}</dd></div><div><dt>Observed</dt><dd>{new Date(telemetry.observedAt).toLocaleTimeString()}</dd></div></dl> : <p className="dialog-message">No device telemetry has been received yet.</p>}

      <h3 className="detail-section-title">DHCP leases {leases !== undefined ? `(${leases.length})` : ""}</h3>
      {leases === undefined ? <p className="dialog-message">Loading leases…</p> : leases.length === 0 ? <p className="dialog-message">No DHCP leases have been collected for this router.</p> : <div className="detail-list">{leases.map((lease) => <div key={lease._id} className="detail-row"><strong>{lease.ipAddress}</strong><span>{lease.macAddress} · {lease.hostname ?? "—"} · {lease.status ?? "bound"}</span><small>{lease.expiresAt ? `expires ${relativeTime(lease.expiresAt)}` : ""}</small></div>)}</div>}

      <h3 className="detail-section-title">Simple queues {queues !== undefined ? `(${queues.length})` : ""}</h3>
      {queues === undefined ? <p className="dialog-message">Loading queues…</p> : queues.length === 0 ? <p className="dialog-message">No simple queues have been collected for this router.</p> : <div className="detail-list">{queues.map((queue) => <div key={queue._id} className="detail-row"><strong>{queue.name}</strong><span>{queue.target ?? "—"} · {queue.disabled ? "disabled" : "enabled"}</span><small>{queue.maxLimitBps ? `${bytes(queue.maxLimitBps)}/s max` : ""}</small></div>)}</div>}

      {telemetry?.ethernetPorts && telemetry.ethernetPorts.length > 0 ? <><h3 className="detail-section-title">Ethernet ports</h3><div className="detail-list">{telemetry.ethernetPorts.map((port) => <div key={port.name} className="detail-row"><strong>{port.name}</strong><span>{port.running ? "up" : "down"}{port.linkSpeedMbps ? ` @ ${port.linkSpeedMbps} Mbps` : ""}{port.duplex ? ` · ${port.duplex}` : ""}</span></div>)}</div></> : null}
      {telemetry?.wifiRadios && telemetry.wifiRadios.length > 0 ? <><h3 className="detail-section-title">WiFi radios</h3><div className="detail-list">{telemetry.wifiRadios.map((radio) => <div key={radio.interfaceName} className="detail-row"><strong>{radio.interfaceName}</strong><span>{radio.state ?? "—"}{radio.frequency ? ` · ${radio.frequency} MHz` : ""}{radio.channel ? ` · ch ${radio.channel}` : ""}</span><small>{radio.clientCount !== undefined ? `${radio.clientCount} clients` : ""}</small></div>)}</div></> : null}
    </div>
  </div>;
}

function OpsHealthStrip() {
  const events = useQuery(api.operations.getRecentSystemEvents, { limit: 6 });
  if (!events || events.length === 0) return null;
  return <section className="ops-health-strip workspace-card" aria-label="Telemetry service health">
    <div className="ops-health-head"><Boxes aria-hidden="true" size={15} /><strong>Telemetry health</strong><span>{events.length} recent event{events.length === 1 ? "" : "s"}</span></div>
    <div className="ops-health-list">{events.map((event) => <div key={event._id} className="ops-health-item"><span className={`status-dot ${event.severity === "critical" ? "status-dot-danger" : event.severity === "warning" ? "status-dot-warning" : "status-dot-online"}`} /><p><strong>{event.title}</strong><small>{event.routerName ?? "System"} · {relativeTime(event.occurredAt)}{event.details ? ` — ${event.details}` : ""}</small></p></div>)}</div>
  </section>;
}

function ComparisonDialog({ accessPoints, onClose }: { accessPoints: { accessPoint: { _id: Id<"accessPoints">; name: string; capacity?: number }; activeUserCount: number; dailyBytes: number; health: { linkState: boolean } | null }[]; onClose: () => void }) { return <div className="operations-modal" role="dialog" aria-modal="true" aria-label="Compare access points"><div className="operations-dialog workspace-card"><div className="section-heading"><div><p className="eyebrow">Capacity and activity</p><h2>Access point comparison</h2></div><button type="button" className="secondary-button" onClick={onClose}>Close</button></div><div className="comparison-table"><div className="comparison-row comparison-head"><span>Access point</span><span>Status</span><span>Users</span><span>Capacity</span><span>Data today</span></div>{accessPoints.map((item) => <div key={item.accessPoint._id} className="comparison-row"><strong>{item.accessPoint.name}</strong><span>{item.health?.linkState ? "Online" : "Pending"}</span><span>{item.activeUserCount}</span><span>{item.accessPoint.capacity ? `${item.activeUserCount}/${item.accessPoint.capacity}` : "Not configured"}</span><span>{bytes(item.dailyBytes)}</span></div>)}</div></div></div>; }

function AdminOverviewSection() {
  const metrics = useQuery(api.platform.getPlatformDashboardMetrics, {});
  const missingCostMarkets = metrics?.missingCostMarkets ?? [];
  const unstaffedMarkets = metrics?.unstaffedMarkets ?? 0;
  const activeProspects = metrics?.activeProspects ?? 0;
  const hasActionItems =
    !!metrics &&
    (missingCostMarkets.length > 0 || unstaffedMarkets > 0 || activeProspects > 0);

  return <section className="section-block" aria-label="Master administration overview">
    <div className="section-heading"><div><p className="eyebrow">Master administration</p><h2>Platform status</h2></div><div className="page-action-group"><Link href="/markets" className="secondary-button"><Boxes aria-hidden="true" size={15} />Markets</Link><Link href="/agents" className="secondary-button"><Users aria-hidden="true" size={15} />Agents</Link></div></div>

    <div className="metric-grid">
      <div className="metric-card workspace-card metric-card-danger">
        <div className="metric-icon"><AlertTriangle aria-hidden="true" size={20} /></div>
        <p>Open alerts</p>
        <strong>{metrics?.openAlerts ?? "—"}</strong>
        <small>Requiring attention</small>
      </div>
      <div className="metric-card workspace-card metric-card-success">
        <div className="metric-icon"><Boxes aria-hidden="true" size={20} /></div>
        <p>Active markets</p>
        <strong>{metrics?.activeMarkets ?? "—"}</strong>
        <small>Live service areas</small>
      </div>
      <div className="metric-card workspace-card metric-card-warning">
        <div className="metric-icon"><Users aria-hidden="true" size={20} /></div>
        <p>Agents awaiting offboarding</p>
        <strong>{metrics?.pendingOffboard ?? "—"}</strong>
        <small>Terminated, pending close-out</small>
      </div>
      <div className="metric-card workspace-card metric-card-accent">
        <div className="metric-icon"><CircleDollarSign aria-hidden="true" size={20} /></div>
        <p>Commissions awaiting approval</p>
        <strong>{metrics?.awaitingApproval ?? "—"}</strong>
        <small>Requested payouts</small>
      </div>
    </div>

    <div className="platform-action-items">
      <h2 className="section-heading" style={{ marginBottom: 12 }}>
        <span style={{ fontSize: 19, fontWeight: 750 }}>Action items</span>
      </h2>
      {hasActionItems ? (
        <div className="platform-actions-grid">
          {missingCostMarkets.length > 0 && (
            <Link href="/markets" className="platform-action-card platform-action-card-warning">
              <strong>Missing operating costs — {missingCostMarkets.length}</strong>
              <span>
                {missingCostMarkets.map((m) => m.name).join(", ")} have no cost entry for this month.
                Missing entries are a visible gap in break-even, never silently defaulted.
              </span>
            </Link>
          )}
          {unstaffedMarkets > 0 && (
            <Link href="/markets" className="platform-action-card platform-action-card-warning">
              <strong>Unstaffed markets — {unstaffedMarkets}</strong>
              <span>
                {unstaffedMarkets} active market(s) have no active agent assignment. Assign an agent.
              </span>
            </Link>
          )}
          {activeProspects > 0 && (
            <Link href="/prospects" className="platform-action-card platform-action-card-accent">
              <strong>Prospects in pipeline — {activeProspects}</strong>
              <span>
                {activeProspects} prospect(s) not yet operational. Advance or provision them.
              </span>
            </Link>
          )}
        </div>
      ) : (
        <p className="pf-muted">No outstanding action items.</p>
      )}
    </div>

    <div className="platform-quick-links">
      <h2 className="section-heading" style={{ marginBottom: 0 }}>
        <span style={{ fontSize: 19, fontWeight: 750 }}>Manage</span>
      </h2>
      <div className="platform-quick-grid">
        {[
          { href: "/markets", label: "Markets", desc: "Service areas and operating costs" },
          { href: "/devices", label: "Devices", desc: "Gateways, APs and replacement log" },
          { href: "/agents", label: "Agents", desc: "Assignments and offboarding" },
          { href: "/vouchers", label: "Vouchers", desc: "Batches and redemption" },
          { href: "/commissions", label: "Commissions", desc: "Payout approval workflow" },
          { href: "/incidents", label: "Incident & alert desk", desc: "Root-cause grouped alerts and incidents" },
        ].map(({ href, label, desc }) => (
          <Link key={href} href={href} className="platform-quick-card">
            <strong>{label}</strong>
            <span>{desc}</span>
          </Link>
        ))}
      </div>
    </div>
  </section>;
}