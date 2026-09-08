"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useQuery } from "@/app/lib/convex";
import { Activity, Boxes, Monitor, RadioTower, Router, Users, Wifi } from "lucide-react";
import { api } from "@/convex/_generated/api";
import Kpi from "@/app/components/Kpi";
import { HealthGuardQuickActions } from "@/app/components/router/HealthGuardQuickActions";

type DashboardRow = NonNullable<ReturnType<typeof useQuery<typeof api.dashboard.getRouterDashboard>>>[number];

function relativeTime(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 5_000) return "just now";
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

const FRESH_WINDOW = 120_000;

function countFreshRows(rows: DashboardRow[]): number {
  const now = Date.now();
  return rows.filter((row) => row.health && now - row.health.timestamp < FRESH_WINDOW).length;
}

function freshRowsLabel(rows: DashboardRow[]): string {
  return `${countFreshRows(rows)}/${rows.length}`;
}

function UtilizationBar({ percent }: { percent: number }) {
  const tone = percent >= 100 ? "danger" : percent >= 90 ? "warning" : "ok";
  return <div className={`utilization-bar ${tone}`}><i style={{ width: `${Math.min(100, percent)}%` }} /></div>;
}

function CardKpi({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: React.ReactNode; detail: string; tone?: "ok" | "warn" | "danger" | "neutral" }) {
  return <Kpi className="workspace-card" tone={tone} icon={icon} label={label} value={value} detail={detail} />;
}

export default function ConsolePage() {
const currentUser = useQuery(api.platform.getCurrentPlatformUser, {});
  const rows = useQuery(api.dashboard.getRouterDashboard, {});
  const onboarding = useQuery(api.routers.getOnboardingStatuses, {});
  const aps = useQuery(api.accessPoints.listAccessPoints, {});
  const switches = useQuery(api.networkSwitches.listSwitches, {});
  const healthguardStates = useQuery(api.deviceCommands.listAllRouterHealthguardStates, {});

  const liveCount = useMemo(() => countFreshRows((rows ?? []) as DashboardRow[]), [rows]);

  const totalUsers = useMemo(() => ((rows ?? []) as DashboardRow[]).reduce((sum, row) => sum + (row.health?.connectedUserCount ?? 0), 0), [rows]);

  const healthguardByRouter = useMemo(() => {
    const map = new Map<string, NonNullable<typeof healthguardStates>[number]>();
    for (const state of (healthguardStates ?? []) as NonNullable<typeof healthguardStates>) map.set(state.routerId, state);
    return map;
  }, [healthguardStates]);

  if (currentUser === undefined || rows === undefined || rows === null || onboarding === undefined || aps === undefined || switches === undefined || healthguardStates === undefined) {
    return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading console…</div></div>;
  }
  const allRows = rows as DashboardRow[];
  if (!currentUser?.isPlatform) {
    return <div className="workspace-page"><header className="page-heading"><div><p className="eyebrow">Network operations</p><h1 className="page-title">Access restricted</h1><p className="page-subtitle">A platform role is required to view the network console.</p></div></header></div>;
  }

  return <div className="workspace-page">
    <header className="page-heading">
      <div>
        <p className="eyebrow">Network operations · Console</p>
        <h1 className="page-title">Network console</h1>
        <p className="page-subtitle">At-a-glance status across the router estate. Open any router card to reach its full console.</p>
      </div>
    </header>

<section className="router-console-kpis">
      <CardKpi tone={allRows.length === 0 ? "neutral" : liveCount === allRows.length ? "ok" : liveCount === 0 ? "danger" : "warn"} icon={<Router size={17} />} label="Routers" value={allRows.length} detail={`${liveCount} reporting live now`} />
      <CardKpi tone={totalUsers > 0 ? "ok" : "neutral"} icon={<Users size={17} />} label="Online users" value={totalUsers} detail="Active hotspot sessions" />
      <CardKpi icon={<Wifi size={17} />} label="Access points" value={aps.length} detail="Registered across routers" />
      <CardKpi icon={<Boxes size={17} />} label="Switches" value={switches.length} detail="Linked to router ports" />
      <CardKpi tone={allRows.length === 0 ? "neutral" : liveCount === allRows.length ? "ok" : liveCount === 0 ? "danger" : "warn"} icon={<RadioTower size={17} />} label="Collector reach" value={freshRowsLabel(allRows)} detail="Healthy in the last 2 minutes" />
    </section>

    {allRows.length === 0 ? <section className="workspace-card p-8 text-center"><h2 className="font-semibold">No routers registered</h2><p className="mt-1 text-sm text-slate-600">Add the first router from the Router estate page to start monitoring.</p><Link className="primary-button mt-4 inline-flex" href="/routers"><Router size={16} />Open router estate</Link></section> : <section className="grid gap-4 lg:grid-cols-2">{allRows.map((row) => {
      const router = row.router;
      const state = onboarding.find((entry) => entry.routerId === router._id);
      const status = state?.status === "live" ? "status-pill-success" : state?.status === "collector_failed" ? "status-pill-danger" : "status-pill-warning";
      const statusLabel = state?.status === "live" ? "Live" : state?.status === "collector_failed" ? "Collector blocked" : "Onboarding";
const routerSwitches = switches.filter((entry) => entry.routerId === router._id);
      const routerAps = (row.accessPoints ?? []).filter((entry) => entry.accessPoint.archivedAt === undefined);
      const liveAps = routerAps.filter((entry) => entry.health?.linkState).length;
      const canManage = currentUser?.permissions?.includes("routers:manage") ?? false;
      const healthguard = healthguardByRouter.get(router._id);
      return <article key={router._id} className="workspace-card console-card">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={`/routers/${router._id}`} className="text-lg font-semibold hover:text-orange-700">{router.name}</Link>
            <p className="mt-0.5 text-sm text-slate-600">{router.location}</p>
            <span className={`status-pill ${status}`}>{statusLabel}</span>
          </div>
          <Link href={`/routers/${router._id}`} className="secondary-button"><Monitor size={15} />Open console</Link>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div><span className="block text-xs uppercase tracking-wide text-slate-500">CPU</span><strong>{row.health?.cpuPercent !== undefined ? `${Math.round(row.health.cpuPercent)}%` : "—"}</strong><UtilizationBar percent={row.health?.cpuPercent ?? 0} /></div>
          <div><span className="block text-xs uppercase tracking-wide text-slate-500">Memory</span><strong>{row.health?.memoryPercent !== undefined ? `${Math.round(row.health.memoryPercent)}%` : "—"}</strong><UtilizationBar percent={row.health?.memoryPercent ?? 0} /></div>
          <div><span className="block text-xs uppercase tracking-wide text-slate-500">Live users</span><strong>{row.health?.connectedUserCount ?? 0}</strong></div>
          <div><span className="block text-xs uppercase tracking-wide text-slate-500">Last telemetry</span><strong>{row.health?.timestamp ? relativeTime(row.health.timestamp) : "—"}</strong></div>
          <div><span className="block text-xs uppercase tracking-wide text-slate-500">Access points</span><strong>{liveAps}/{routerAps.length}</strong></div>
          <div><span className="block text-xs uppercase tracking-wide text-slate-500">Switches</span><strong>{routerSwitches.length}</strong></div>
        </div>
        <div className="console-card-footer"><HealthGuardQuickActions routerId={router._id} state={healthguard} canManage={canManage} /></div>
      </article>;
    })}</section>}
  </div>;
}
