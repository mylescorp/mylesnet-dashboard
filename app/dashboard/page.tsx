"use client";

import { useQuery } from "convex/react";
import { Activity, ArrowUpRight, BarChart3, Gauge, RadioTower, SlidersHorizontal, Users, Wifi } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { HealthTrendChart } from "../components/HealthTrendChart";

const bytes = (value: number) => value < 1024 ? `${Math.round(value)} B` : value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB` : value < 1024 ** 3 ? `${(value / 1024 ** 2).toFixed(1)} MB` : `${(value / 1024 ** 3).toFixed(2)} GB`;
const rate = (value: number) => `${bytes(value)}/s`;

export default function DashboardPage() {
  const router = useRouter();
  const overview = useQuery(api.operations.getOverview);
  const [selectedRouterId, setSelectedRouterId] = useState<Id<"routers"> | null>(null);
  const [selectedAccessPointId, setSelectedAccessPointId] = useState<Id<"accessPoints"> | null>(null);
  const [showComparison, setShowComparison] = useState(false);
  const [compact, setCompact] = useState(false);
  const accessPointUsers = useQuery(api.operations.getAccessPointUsers, selectedAccessPointId ? { accessPointId: selectedAccessPointId } : "skip");

  const selectedRouter = overview?.routers.find((entry) => entry.router._id === selectedRouterId) ?? null;
  const visibleRouters = selectedRouter ? [selectedRouter] : overview?.routers ?? [];
  const visibleAccessPoints = visibleRouters.flatMap((entry) => entry.accessPoints.map((accessPoint) => ({ ...accessPoint, router: entry.router })));
  const selectedAccessPoint = visibleAccessPoints.find((item) => item.accessPoint._id === selectedAccessPointId) ?? null;

  if (!overview) return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading the operational overview…</div></div>;

  const { metrics } = overview;
  const healthStatus = metrics.healthScore === null ? "Awaiting telemetry" : metrics.healthScore === 100 ? "Healthy" : "Needs attention";

  return <div className={`workspace-page dashboard-page ${compact ? "dashboard-compact" : ""}`}>
    <header className="page-heading">
      <div><p className="eyebrow">MylesNet operations centre</p><h1 className="page-title">Network overview</h1><p className="page-subtitle">Live collector-backed access point, user, capacity, and service-assurance telemetry.</p></div>
      <div className="page-action-group"><button type="button" className="secondary-button" onClick={() => setCompact((value) => !value)}><SlidersHorizontal aria-hidden="true" size={17} />{compact ? "Comfortable view" : "Compact view"}</button><button type="button" onClick={() => router.push("/routers")} className="primary-button"><RadioTower aria-hidden="true" size={18} />Router settings</button></div>
    </header>

    <section className="operations-kpi-strip" aria-label="Live operations status">
      <Kpi label="Collector status" value={metrics.collectorConnected ? "Connected" : "Awaiting data"} detail={metrics.lastObservedAt ? `Last observation ${new Date(metrics.lastObservedAt).toLocaleTimeString()}` : "No collector observation received"} icon={<Activity size={17} />} />
      <Kpi label="Network health" value={healthStatus} detail={metrics.healthScore === null ? "No access point telemetry" : `${metrics.healthScore}% of access points online`} icon={<Gauge size={17} />} />
      <Kpi label="Live users" value={metrics.totalUsers} detail="Current hotspot sessions" icon={<Users size={17} />} />
      <Kpi label="Access points" value={`${metrics.activeAccessPoints}/${metrics.totalAccessPoints}`} detail="Links currently online" icon={<Wifi size={17} />} />
      <Kpi label="Data used" value={bytes(metrics.totalDailyBytes)} detail="Observed in the last 24 hours" icon={<BarChart3 size={17} />} />
      <Kpi label="Router load" value={metrics.averageCpu === null ? "—" : `${Math.round(metrics.averageCpu)}% CPU`} detail="Average reported CPU load" icon={<Gauge size={17} />} />
    </section>

    <section className="dashboard-toolbar workspace-card">
      <div><span className="toolbar-label">Operational scope</span><strong>Filter the operational view to a single router, or review the complete estate.</strong></div>
      <label className="router-select-label">Router<select value={selectedRouterId ?? ""} onChange={(event) => { const selected = overview.routers.find((entry) => entry.router._id === event.target.value); setSelectedRouterId(selected?.router._id ?? null); }}><option value="">All routers</option>{overview.routers.map((entry) => <option key={entry.router._id} value={entry.router._id}>{entry.router.name} · {entry.router.location}</option>)}</select></label>
    </section>

    <section className="section-block"><div className="section-heading"><div><p className="eyebrow">Access point activity</p><h2>Live capacity and traffic</h2></div><button type="button" className="secondary-button" onClick={() => setShowComparison(true)} disabled={visibleAccessPoints.length < 2}>Compare access points <ArrowUpRight aria-hidden="true" size={16} /></button></div>
      {visibleAccessPoints.length ? <div className="access-point-grid access-point-grid-rich">{visibleAccessPoints.map(({ accessPoint, health, activeUserCount, dailyBytes, trafficTrend, router: apRouter }) => {
        const capacity = accessPoint.capacity;
        const capacityPercent = capacity && capacity > 0 ? Math.min(100, (activeUserCount / capacity) * 100) : null;
        return <article key={accessPoint._id} className="access-point-card workspace-card"><div className="access-point-head"><div><h3>{accessPoint.name}</h3><p>{accessPoint.port} · {apRouter.name}</p></div><span className={`status-pill ${health?.linkState ? "status-pill-success" : "status-pill-warning"}`}>{health?.linkState ? "Running" : "Awaiting telemetry"}</span></div>
          <div className="ap-user-row"><span><Users aria-hidden="true" size={15} />Users</span><strong>{activeUserCount}</strong></div>
          <div className="ap-traffic"><span>Current speed</span><strong>↓ {rate(health?.rxBytesPerSec ?? 0)} · ↑ {rate(health?.txBytesPerSec ?? 0)}</strong><Sparkline points={trafficTrend.map((point) => point.bytesPerSecond)} /></div>
          <dl className="access-point-stats"><div><dt>Health</dt><dd>{health?.linkState ? "Good" : "Pending"}</dd></div><div><dt>Rate limit</dt><dd>{accessPoint.rateLimitReference ?? "Not configured"}</dd></div><div><dt>Data used</dt><dd>{bytes(dailyBytes)}</dd></div><div><dt>Errors / drops</dt><dd>{(health?.errorCount ?? 0) + (health?.queueDrops ?? 0)}</dd></div></dl>
          <div className="ap-capacity"><div><span>Capacity</span><strong>{capacity ? `${activeUserCount} / ${capacity} users` : "Not configured"}</strong></div>{capacityPercent !== null ? <i><b style={{ width: `${capacityPercent}%` }} /></i> : null}</div>
          <div className="access-point-actions"><button type="button" className="secondary-button" onClick={() => setSelectedAccessPointId(accessPoint._id)}>View users</button><button type="button" className="primary-button" onClick={() => { setSelectedRouterId(apRouter._id); document.getElementById("router-health")?.scrollIntoView({ behavior: "smooth", block: "start" }); }}>Details</button></div>
        </article>;
      })}</div> : <Empty title="No access points are registered" detail="Add access point records from Router settings before they can appear in the live operation view." action={() => router.push("/routers")} label="Manage routers" />}
    </section>

    <section id="router-health" className="section-block dashboard-bottom-grid"><div className="workspace-card upstream-card"><p className="eyebrow">Upstream health</p><h2>Route observation</h2><div className="upstream-list">{visibleRouters.map((entry) => <div key={entry.router._id}><span className={`status-dot ${entry.upstream.configured ? "status-dot-online" : "status-dot-warning"}`} /><p><strong>{entry.router.name}</strong><small>{entry.upstream.configured ? "A default route is present in the most recent collector snapshot." : "No current default-route observation has been received."}</small></p></div>)}</div></div>
      <div className="workspace-card quick-actions"><p className="eyebrow">Service assurance</p><h2>Operator work areas</h2><p>Review incidents, retain an operational handover, or open the complete usage report.</p><div><button type="button" className="secondary-button" onClick={() => router.push("/incidents")}>Incident desk</button><button type="button" className="secondary-button" onClick={() => router.push("/shift-notes")}>Shift handover</button><button type="button" className="secondary-button" onClick={() => router.push("/usage")}>Usage reports</button></div></div>
    </section>

    {selectedRouter ? <section className="section-block" id="health-trends"><HealthTrendChart routerId={selectedRouter.router._id} /></section> : null}
    {selectedAccessPointId ? <AccessPointUsersDialog title={selectedAccessPoint?.accessPoint.name ?? "Access point"} users={accessPointUsers} onClose={() => setSelectedAccessPointId(null)} /> : null}
    {showComparison ? <ComparisonDialog accessPoints={visibleAccessPoints} onClose={() => setShowComparison(false)} /> : null}
  </div>;
}

function Kpi({ label, value, detail, icon }: { label: string; value: string | number; detail: string; icon: React.ReactNode }) { return <article className="operations-kpi"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>; }
function Sparkline({ points }: { points: number[] }) { const max = Math.max(...points, 1); const coordinates = points.length < 2 ? "0,34 100,34" : points.map((point, index) => `${(index / (points.length - 1)) * 100},${34 - (point / max) * 28}`).join(" "); return <svg viewBox="0 0 100 36" preserveAspectRatio="none" aria-label="Recent traffic trend" role="img"><polyline points={coordinates} /></svg>; }
function Empty({ title, detail, action, label }: { title: string; detail: string; action: () => void; label: string }) { return <div className="empty-state workspace-card"><h3>{title}</h3><p>{detail}</p><button type="button" className="primary-button" onClick={action}>{label}</button></div>; }
function AccessPointUsersDialog({ title, users, onClose }: { title: string; users: { _id: Id<"activeHotspotSessions">; subscriberIdentifier: string; observedAt: number; observedBytes: number }[] | undefined; onClose: () => void }) { return <div className="operations-modal" role="dialog" aria-modal="true" aria-label={`${title} users`}><div className="operations-dialog workspace-card"><div className="section-heading"><div><p className="eyebrow">Live hotspot users</p><h2>{title}</h2></div><button type="button" className="secondary-button" onClick={onClose}>Close</button></div>{users === undefined ? <p className="dialog-message">Loading current hotspot sessions…</p> : users.length === 0 ? <p className="dialog-message">No active hotspot sessions are currently mapped to this access point.</p> : <div className="session-list">{users.map((user) => <div key={user._id}><strong>{user.subscriberIdentifier}</strong><span>Observed {new Date(user.observedAt).toLocaleTimeString()} · {bytes(user.observedBytes)}</span></div>)}</div>}</div></div>; }
function ComparisonDialog({ accessPoints, onClose }: { accessPoints: { accessPoint: { _id: Id<"accessPoints">; name: string; capacity?: number }; activeUserCount: number; dailyBytes: number; health: { linkState: boolean } | null }[]; onClose: () => void }) { return <div className="operations-modal" role="dialog" aria-modal="true" aria-label="Compare access points"><div className="operations-dialog workspace-card"><div className="section-heading"><div><p className="eyebrow">Capacity and activity</p><h2>Access point comparison</h2></div><button type="button" className="secondary-button" onClick={onClose}>Close</button></div><div className="comparison-table"><div className="comparison-row comparison-head"><span>Access point</span><span>Status</span><span>Users</span><span>Capacity</span><span>Data today</span></div>{accessPoints.map((item) => <div key={item.accessPoint._id} className="comparison-row"><strong>{item.accessPoint.name}</strong><span>{item.health?.linkState ? "Online" : "Pending"}</span><span>{item.activeUserCount}</span><span>{item.accessPoint.capacity ? `${item.activeUserCount}/${item.accessPoint.capacity}` : "Not configured"}</span><span>{bytes(item.dailyBytes)}</span></div>)}</div></div></div>; }
