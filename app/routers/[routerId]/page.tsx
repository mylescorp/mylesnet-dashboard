"use client";

import { useParams, useRouter } from "next/navigation";
import { useAction, useMutation, useQuery } from "@/app/lib/convex";
import { useState, type FormEvent, type ReactNode } from "react";
import {
  Activity,
  ArrowLeft,
  Archive,
  BarChart3,
  Boxes,
  Cable,
  Clipboard,
  Database,
  FileDiff,
  Fingerprint,
  Gauge,
  Globe,
  HardDrive,
  LayoutGrid,
  ListChecks,
  MemoryStick,
  Network,
  Pencil,
  Plus,
  RadioTower,
  RefreshCw,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Timer,
  Users,
  Wifi,
  Zap,
} from "lucide-react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { ApEditor, RouterEditor, SwitchEditor, errorText, type AccessPointRow, type RouterRow, type SwitchRow } from "@/app/components/router/RouterEditors";
import { ConfigWatchPanel } from "@/app/components/router/ConfigWatchPanel";
import { HealthGuardPanel } from "@/app/components/router/HealthGuardPanel";

const bytes = (value: number) => value < 1024 ? `${Math.round(value)} B` : value < 1024 ** 2 ? `${(value / 1024).toFixed(1)} KB` : value < 1024 ** 3 ? `${(value / 1024 ** 2).toFixed(1)} MB` : `${(value / 1024 ** 3).toFixed(2)} GB`;
const rate = (value: number) => `${bytes(value)}/s`;

function relativeTime(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 5_000) return "just now";
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

function isFresh(observedAt: number | undefined): boolean {
  return observedAt !== undefined && Date.now() - observedAt < 60_000;
}

function uptimeLabel(uptimeMs: number): string {
  return relativeTime(Math.max(0, Date.now() - uptimeMs));
}

function Card({ title, eyebrow, actions, children }: { title?: string; eyebrow?: string; actions?: ReactNode; children: ReactNode }) {
  return <section className="workspace-card console-card"><div className="section-heading"><div>{eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}{title ? <h2>{title}</h2> : null}</div>{actions ? <div className="page-action-group">{actions}</div> : null}</div>{children}</section>;
}

function JsonViewer({ value, compact = false }: { value: unknown; compact?: boolean }) {
  const rendered = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "—";
  const isArray = Array.isArray(value);
  const count = isArray ? value.length : undefined;
  const preview = compact && rendered.length > 3200 ? `${rendered.slice(0, 3200)}\n… truncated` : rendered;
  return <div><p className="console-note">{isArray ? `${count} record${count === 1 ? "" : "s"} · snapshot below` : "Snapshot below"}</p><pre className="json-viewer">{preview}</pre></div>;
}

function UtilizationBar({ percent }: { percent: number }) {
  const tone = percent >= 100 ? "danger" : percent >= 90 ? "warning" : "ok";
  return <div className={`utilization-bar ${tone}`}><i style={{ width: `${Math.min(100, percent)}%` }} /></div>;
}

function Pill({ tone, children }: { tone: "success" | "warning" | "danger" | "neutral"; children: ReactNode }) {
  const classes = { success: "status-pill-success", warning: "status-pill-warning", danger: "status-pill-danger", neutral: "status-pill-neutral" } as const;
  return <span className={`status-pill ${classes[tone]}`}>{children}</span>;
}

const tabs = [
  { id: "overview", label: "Overview", icon: Activity },
  { id: "setup", label: "Setup", icon: Settings2 },
  { id: "access", label: "Access points", icon: Wifi },
  { id: "switches", label: "Switches", icon: Network },
  { id: "dhcp", label: "DHCP & queues", icon: Database },
  { id: "live", label: "Live inspection", icon: Cable },
  { id: "config", label: "Configuration", icon: FileDiff },
  { id: "thresholds", label: "Thresholds", icon: SlidersHorizontal },
] as const;
type TabId = (typeof tabs)[number]["id"];

export default function RouterConsolePage() {
  const params = useParams<{ routerId: string }>();
  const routerId = params.routerId as Id<"routers">;
  const nav = useRouter();

  const routers = useQuery(api.routers.listRouters, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const aps = useQuery(api.accessPoints.listAccessPoints, { routerId });
  const switches = useQuery(api.networkSwitches.listSwitches, { routerId });
  const onboarding = useQuery(api.routers.getOnboardingStatuses, {});
  const live = useQuery(api.operations.getLiveRouter, { routerId });
  const health = useQuery(api.healthSamples.getLatestRouterHealth, { routerId });
  const telemetry = useQuery(api.operations.getRouterTelemetryLatest, { routerId });
  const leases = useQuery(api.operations.getDhcpLeases, { routerId });
  const queues = useQuery(api.operations.getSimpleQueues, { routerId });
  const pools = useQuery(api.operations.getDhcpPoolOverview, { routerId });
  const runHistory = useQuery(api.collector.getCollectorRunHistory, { routerId, limit: 15 });
  const thresholds = useQuery(api.thresholds.getRouterMonitorThresholds, { routerId });
  const incidents = useQuery(api.incidents.listIncidents, { routerId });
  const systemEvents = useQuery(api.operations.getRecentSystemEvents, { limit: 20 });

  const archiveRouter = useMutation(api.routers.archiveRouter);
  const archiveAp = useMutation(api.accessPoints.archiveAccessPoint);
  const archiveSwitch = useMutation(api.networkSwitches.archiveSwitch);

  const [tab, setTab] = useState<TabId>("overview");
  const [routerEditor, setRouterEditor] = useState<RouterRow | false>(false);
  const [apEditor, setApEditor] = useState<{ routerId: Id<"routers">; item?: AccessPointRow } | null>(null);
  const [switchEditor, setSwitchEditor] = useState<{ item?: SwitchRow } | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const router = routers?.find((entry) => entry._id === routerId);
  const onboardingState = onboarding?.find((entry) => entry.routerId === routerId);
  const market = markets?.find((entry) => entry._id === router?.marketId);
  const routerEvents = (systemEvents ?? []).filter((event) => event.routerId === routerId);

  if (routers === undefined || markets === undefined || onboarding === undefined || switches === undefined) {
    return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading router console…</div></div>;
  }
  if (!router) {
    return <div className="workspace-page"><header className="page-heading"><div><p className="eyebrow">Network operations</p><h1 className="page-title">Router not found</h1><p className="page-subtitle">This router does not exist or has been archived.</p></div><button type="button" className="secondary-button" onClick={() => nav.push("/routers")}><ArrowLeft size={16} />Back to inventory</button></header></div>;
  }

  const statusTone = onboardingState?.status === "live" ? "success" : onboardingState?.status === "collector_failed" ? "danger" : "warning";
  const statusLabel = onboardingState?.status === "live" ? "Live" : onboardingState?.status === "collector_failed" ? "Collector blocked" : "Onboarding";
  const collectorFresh = isFresh(runHistory?.[0]?.observedAt);

  return <div className="workspace-page"><header className="page-heading">
    <div>
      <p className="eyebrow">Network operations · Router console</p>
      <h1 className="page-title">{router.name}</h1>
      <div className="page-subtitle"><Pill tone={statusTone}>{statusLabel}</Pill><span>{router.location}{market ? ` · ${market.name}` : " · No market assigned"}{onboardingState?.lastTelemetryAt ? ` · Last telemetry ${relativeTime(onboardingState.lastTelemetryAt)}` : ""}</span></div>
    </div>
    <div className="page-action-group"><button type="button" className="secondary-button" onClick={() => nav.push("/routers")}><ArrowLeft size={16} />Inventory</button><button type="button" className="secondary-button" onClick={() => navigator.clipboard.writeText(router._id).then(() => setMessage("Collector router identifier copied.")).catch(() => setMessage("Copy failed; select the identifier manually."))}><Clipboard size={16} />Copy ID</button><button type="button" className="primary-button" onClick={() => setRouterEditor(router)}><Settings2 size={17} />Edit settings</button></div>
  </header>

    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}

    <section className="router-console-kpis">
      <CardKpi icon={<RadioTower size={17} />} label="Collector" value={statusLabel} detail={collectorFresh ? "Telemetry is current" : onboardingState?.collectorMessage ?? "Waiting for the local collector"} />
      <CardKpi icon={<Gauge size={17} />} label="CPU" value={health?.cpuPercent !== undefined ? `${Math.round(health.cpuPercent)}%` : "—"} detail={thresholds ? `alert > ${thresholds.cpuWarningThreshold}%` : "awaiting thresholds"} />
      <CardKpi icon={<MemoryStick size={17} />} label="Memory" value={health?.memoryPercent !== undefined ? `${Math.round(health.memoryPercent)}%` : "—"} detail={thresholds ? `alert > ${thresholds.memoryWarningThreshold}%` : "awaiting thresholds"} />
      <CardKpi icon={<Users size={17} />} label="Live users" value={health?.connectedUserCount ?? 0} detail="Active hotspot sessions" />
      <CardKpi icon={<Timer size={17} />} label="Round-trip" value={runHistory?.[0]?.latencyMs !== undefined ? `${Math.round(runHistory[0].latencyMs)} ms` : "—"} detail={runHistory?.[0]?.status === "connected" ? "Collector connected" : "Awaiting collector run"} />
    </section>

    <nav className="console-tabs" aria-label="Router console sections">
      {tabs.map((item) => { const Icon = item.icon; return <button key={item.id} type="button" className={`console-tab ${tab === item.id ? "console-tab-active" : ""}`} onClick={() => setTab(item.id)}><Icon aria-hidden="true" size={16} />{item.label}</button>; })}
    </nav>

    {tab === "overview" ? <OverviewTab routerId={routerId} live={live} telemetry={telemetry} runHistory={runHistory ?? []} incidents={incidents ?? []} events={routerEvents} onboardingState={onboardingState} /> : null}
    {tab === "setup" ? <SetupTab router={router} markets={markets} onboardingState={onboardingState} onEdit={() => setRouterEditor(router)} onArchive={async () => { const reason = window.prompt(`Archive ${router.name}? Monitoring history will be kept. Enter a short reason:`); if (!reason?.trim()) return; setBusy("archive"); try { await archiveRouter({ routerId, reason }); setMessage("Router archived. Historical data was preserved."); nav.push("/routers"); } catch (caught) { setMessage(errorText(caught)); } finally { setBusy(null); } }} busy={busy === "archive"} /> : null}
    {tab === "access" ? <AccessTab aps={aps ?? []} live={live} switches={switches} onAdd={() => setApEditor({ routerId })} onEdit={(item) => setApEditor({ routerId, item })} onArchive={async (item) => { const reason = window.prompt(`Archive ${item.name}? Historical data will be preserved. Enter a short reason:`); if (!reason?.trim()) return; setBusy(item._id); try { await archiveAp({ accessPointId: item._id, reason }); setMessage("Access point archived. Historical data was preserved."); } catch (caught) { setMessage(errorText(caught)); } finally { setBusy(null); } }} busy={busy} /> : null}
    {tab === "switches" ? <SwitchesTab switches={switches} aps={aps ?? []} onAdd={() => setSwitchEditor({})} onEdit={(item) => setSwitchEditor({ item })} onArchive={async (item) => { const reason = window.prompt(`Archive switch ${item.name}? Access points linked to it will keep their records but the switch link is cleared. Enter a short reason:`); if (!reason?.trim()) return; setBusy(item._id); try { await archiveSwitch({ switchId: item._id, reason }); setMessage("Switch archived. Its access-point links are preserved on the AP records."); } catch (caught) { setMessage(errorText(caught)); } finally { setBusy(null); } }} busy={busy} /> : null}
    {tab === "dhcp" ? <DhcpTab leases={leases} queues={queues} pools={pools} /> : null}
    {tab === "live" ? <LiveTab routerId={routerId} /> : null}
    {tab === "config" ? <ConfigTab routerId={routerId} /> : null}
    {tab === "thresholds" ? <ThresholdsTab router={router} thresholds={thresholds} /> : null}

    {routerEditor ? <RouterEditor router={router} markets={markets} close={() => setRouterEditor(false)} done={setMessage} /> : null}
    {apEditor ? <ApEditor accessPoint={apEditor.item} routerId={apEditor.routerId} close={() => setApEditor(null)} done={setMessage} /> : null}
    {switchEditor ? <SwitchEditor switchRow={switchEditor.item} routerId={routerId} close={() => setSwitchEditor(null)} done={setMessage} /> : null}
  </div>;
}

function CardKpi({ icon, label, value, detail }: { icon: ReactNode; label: string; value: ReactNode; detail: string }) {
  return <article className="workspace-card operations-kpi"><span>{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>;
}

type RunHistory = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.collector.getCollectorRunHistory>>>>;
type IncidentRow = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.incidents.listIncidents>>>>;
type OnboardingRow = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.routers.getOnboardingStatuses>>>>;
type EventRow = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.operations.getRecentSystemEvents>>>>;
type LiveRouter = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.operations.getLiveRouter>>>>;
type TelemetryRow = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.operations.getRouterTelemetryLatest>>>>;
type Leases = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.operations.getDhcpLeases>>>>;
type Queues = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.operations.getSimpleQueues>>>>;
type PoolOverview = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.operations.getDhcpPoolOverview>>>>;
type ThresholdsRow = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.thresholds.getRouterMonitorThresholds>>>>;

function OverviewTab({ routerId, live, telemetry, runHistory, incidents, events, onboardingState }: { routerId: Id<"routers">; live: LiveRouter | null | undefined; telemetry: TelemetryRow | null | undefined; runHistory: RunHistory; incidents: IncidentRow; events: EventRow; onboardingState: OnboardingRow[number] | undefined }) {
  const latestRun = runHistory[0];
  return <div className="console-grid"><HealthGuardPanel routerId={routerId} />
    <section className="section-block console-col">
      <Card eyebrow="Collector health" title="Latest runs">
        {latestRun ? <dl className="access-point-stats"><div><dt>Last run</dt><dd>{relativeTime(latestRun.observedAt)}</dd></div><div><dt>Status</dt><dd>{latestRun.status}</dd></div><div><dt>Round-trip</dt><dd>{latestRun.latencyMs !== undefined ? `${Math.round(latestRun.latencyMs)} ms` : "—"}</dd></div><div><dt>Consecutive failures</dt><dd>{latestRun.consecutiveFailures ?? 0}</dd></div><div><dt>Process uptime</dt><dd>{latestRun.processUptimeMs !== undefined ? uptimeLabel(latestRun.processUptimeMs) : "—"}</dd></div></dl> : <p className="dialog-message">No collector runs have been recorded for this router. Start the local collector and copy the router ID (top-right) into its configuration.</p>}
        {latestRun?.message ? <p className="collector-card-message">{latestRun.message}</p> : null}
        {latestRun && !isFresh(latestRun.observedAt) ? <p className="dialog-message">Latest observed {relativeTime(latestRun.observedAt)} — the collector may not be running ({onboardingState?.collectorMessage ?? "no message recorded"}).</p> : null}
      </Card>

      <Card eyebrow="Telemetry" title={telemetry?.identity ?? "Device identity"}>
        {telemetry ? <dl className="access-point-stats"><div><dt>Observed</dt><dd>{relativeTime(telemetry.observedAt)}</dd></div><div><dt>Temperature</dt><dd>{telemetry.systemHealth?.temperature !== undefined ? `${telemetry.systemHealth.temperature}${telemetry.systemHealth.temperatureUnit ?? "°"}` : "—"}</dd></div><div><dt>Voltage</dt><dd>{telemetry.systemHealth?.voltage !== undefined ? `${telemetry.systemHealth.voltage} V` : "—"}</dd></div><div><dt>Ethernet up</dt><dd>{telemetry.ethernetPorts?.filter((port) => port.running).length ?? 0}/{telemetry.ethernetPorts?.length ?? 0}</dd></div><div><dt>WiFi radios</dt><dd>{telemetry.wifiRadios?.filter((radio) => radio.state === "running").length ?? 0}/{telemetry.wifiRadios?.length ?? 0}</dd></div></dl> : <p className="dialog-message">Identity and hardware telemetry arrive once extended reads are enabled on the collector.</p>}
      </Card>

      <Card eyebrow="Recent activity" title="Events for this router">
        {events.length === 0 ? <p className="dialog-message">No telemetry service events recorded for this router.</p> : <div className="detail-list">{[...events.slice(0, 6)].map((event) => <div key={event._id} className="detail-row"><span><strong>{event.title}</strong> {event.details ? `· ${event.details}` : ""}</span><span style={{ whiteSpace: "nowrap" }}>{relativeTime(event.occurredAt)}</span></div>)}</div>}
      </Card>
    </section>

    <section className="section-block console-col">
      {live ? <Card eyebrow="Live estate" title={`${live.accessPoints.length} access points`}><div className="access-point-grid access-point-grid-rich">{live.accessPoints.map((entry) => <article key={entry.accessPoint._id} className="access-point-card workspace-card"><div className="access-point-head"><div><h3>{entry.accessPoint.name}</h3><p>{entry.accessPoint.port}</p></div><span className={`status-pill ${entry.health?.linkState ? "status-pill-success" : "status-pill-warning"}`}>{entry.health?.linkState ? "Running" : "Pending"}</span></div><div className="ap-user-row"><span><Users size={15} />Users</span><strong>{entry.activeUserCount}</strong></div><dl className="access-point-stats"><div><dt>Capacity</dt><dd>{entry.accessPoint.capacity ? `${entry.activeUserCount}/${entry.accessPoint.capacity}` : "Not configured"}</dd></div><div><dt>Speed</dt><dd>↓ {rate(entry.health?.rxBytesPerSec ?? 0)} · ↑ {rate(entry.health?.txBytesPerSec ?? 0)}</dd></div><div><dt>Data (24h)</dt><dd>{bytes(entry.dailyBytes)}</dd></div></dl></article>)}</div></Card> : <div className="loading-panel workspace-card"><Activity aria-hidden="true" size={20} />Loading live telemetry…</div>}

      {live ? <Card eyebrow="Upstream" title="Route observation"><div className="upstream-list"><div><span className={`status-dot ${live.upstream.configured ? "status-dot-online" : "status-dot-warning"}`} /><p><strong>{live.upstream.configured ? "Default route present" : "No default-route observation"}</strong><small>{live.upstream.configured ? "The most recent collector snapshot contains a default route." : "Wait for a collector snapshot, or review the Configuration tab."}</small></p></div></div></Card> : null}

      <Card eyebrow="Incidents" title="Open and recent" actions={routerId ? <a className="secondary-button" href="/incidents">Incident desk</a> : undefined}>
        {incidents.length === 0 ? <p className="dialog-message">No incidents recorded for this router.</p> : <div className="detail-list">{incidents.slice(0, 6).map((incident) => <div key={incident._id} className="detail-row"><span><strong>{incident.note}</strong>{incident.resolvedAt ? ` · resolved ${relativeTime(incident.resolvedAt)}` : ""}</span><SeverityPill severity={incident.severity} /></div>)}</div>}
      </Card>
    </section>
  </div>;
}

function SeverityPill({ severity }: { severity: string }) {
  const tone = severity === "critical" ? "danger" : severity === "warning" ? "warning" : "neutral";
  return <Pill tone={tone}>{severity}</Pill>;
}

function SetupTab({ router, markets, onboardingState, onEdit, onArchive, busy }: { router: RouterRow; markets: NonNullable<ReturnType<typeof useQuery<typeof api.markets.listMarkets>>>; onboardingState: OnboardingRow[number] | undefined; onEdit: () => void; onArchive: () => void; busy: boolean }) {
  const marketName = markets.find((entry) => entry._id === router.marketId)?.name ?? "Unassigned";
  const steps = [
    { label: "Router registered", done: true, detail: router.name },
    { label: "Collector credentials", done: router.hasCredentials, detail: router.hasCredentials ? "Encrypted read-only RouterOS credentials are set." : "Add them from Edit settings (Rotate collector credentials section)." },
    { label: "Collector online", done: onboardingState?.status === "live", detail: onboardingState?.status === "live" ? "Telemetry is flowing." : onboardingState?.collectorMessage ?? "Start the collector with the router ID below." },
  ];
  const snippet = [
    `MYLESNET_COLLECTOR_ROUTER_ID=${router._id}`,
    "MYLESNET_COLLECTOR_INGEST_URL=https://<deployment>.convex.site/collector/ingest",
    "MYLESNET_COLLECTOR_INTERVAL_MS=30000",
  ].join("\n");
  const commands = ["npm install", "npm run collector:local:check", "npm run collector:start"].join("\n");

  return <div className="console-grid">
    <section className="section-block console-col">
      <Card eyebrow="Router record" title="Inventory details" actions={<button type="button" className="secondary-button" onClick={onEdit}><Pencil size={15} />Edit settings</button>}>
        <dl className="access-point-stats"><div><dt>Name</dt><dd>{router.name}</dd></div><div><dt>Location</dt><dd>{router.location}</dd></div><div><dt>Market</dt><dd>{marketName}</dd></div><div><dt>HTTPS origin</dt><dd><code>{router.restBaseUrl}</code></dd></div><div><dt>CPU thresholds</dt><dd>{router.cpuWarningThreshold ?? 75}% / {router.cpuCriticalThreshold ?? 90}%</dd></div><div><dt>Memory thresholds</dt><dd>{router.memoryWarningThreshold ?? 80}% / {router.memoryCriticalThreshold ?? 90}%</dd></div></dl>
      </Card>

      <Card eyebrow="Collector connection" title="Onboarding">
        <ol className="setup-steps">{steps.map((step, index) => <li key={step.label} className={step.done ? "setup-step-done" : ""}><span>{index + 1}</span><div><strong>{step.label}</strong><small>{step.detail}</small></div>{step.done ? <ShieldCheck color="var(--success)" size={18} /> : null}</li>)}</ol>
      </Card>
    </section>

    <section className="section-block console-col">
      <Card eyebrow="Collector setup" title="Run the local collector" actions={<button type="button" className="secondary-button" onClick={() => navigator.clipboard.writeText(snippet).then(() => undefined)}><Clipboard size={15} />Copy env</button>}>
        <p className="console-note">The collector talks to RouterOS over the HTTPS origin above using the stored read-only credentials. It never sends credentials to the browser.</p>
        <pre className="json-viewer">{snippet}</pre>
        <h3 className="detail-section-title">Commands</h3>
        <pre className="json-viewer">{commands}</pre>
        <p className="console-note">RouterOS is only ever read. Nothing in this console — or the collector — writes to the router.</p>
      </Card>

      <Card eyebrow="Danger zone" title="Archive this router">
        <p className="console-note">Archiving removes the router from active inventory while preserving all monitoring history (telemetry, incidents, configuration snapshots).</p>
        <button type="button" className="secondary-button" onClick={onArchive} disabled={busy}><Archive size={15} />Archive router</button>
      </Card>
    </section>
  </div>;
}

function AccessTab({ aps, live, switches, onAdd, onEdit, onArchive, busy }: { aps: AccessPointRow[]; live: LiveRouter | null | undefined; switches: ReturnType<typeof useQuery<typeof api.networkSwitches.listSwitches>> | undefined; onAdd: () => void; onEdit: (item: AccessPointRow) => void; onArchive: (item: AccessPointRow) => void; busy: string | null }) {
  const liveByPort = new Map<string, LiveRouter["accessPoints"][number]>();
  if (live) { for (const entry of live.accessPoints) liveByPort.set(entry.accessPoint.port, entry); }
  const switchName = (id: Id<"networkSwitches"> | undefined) => switches?.find((entry) => entry._id === id)?.name;
  return <Card eyebrow="Access points" title={`${aps.length} registered`} actions={<button type="button" className="primary-button" onClick={onAdd}><Plus size={16} />Add access point</button>}>
    {aps.length === 0 ? <p className="dialog-message">No access points are registered for this router. Add one per RouterOS interface (ether port or wifi radio).</p> : <div className="monitor-table"><div className="monitor-head"><span>Name</span><span>Interface</span><span>Status</span><span>Users</span><span>Capacity</span><span>Details</span><span /></div>{aps.map((ap) => { const portLive = liveByPort.get(ap.port); const switchNameForAp = ap.switchId ? (switchName(ap.switchId) ?? null) : null; return <div key={ap._id} className="monitor-row"><strong>{ap.name}</strong><span><code>{ap.port}</code></span><span>{portLive?.health?.linkState ? <Pill tone="success">Running</Pill> : <Pill tone="warning">Pending</Pill>}</span><span>{portLive?.activeUserCount ?? "—"}</span><span>{ap.capacity ? `${portLive?.activeUserCount ?? 0}/${ap.capacity}` : "Not configured"}</span><span className="monitor-detail">{ap.ipAddress ? <span><strong>IP</strong> {ap.ipAddress}</span> : null}{ap.macAddress ? <span><strong>MAC</strong> <code>{ap.macAddress}</code></span> : null}{ap.networkAddress ? <span><strong>Network</strong> <code>{ap.networkAddress}</code></span> : null}{ap.model ? <span><strong>Model</strong> {ap.model}</span> : null}{ap.serialNumber ? <span><strong>Serial</strong> {ap.serialNumber}</span> : null}{switchNameForAp ? <span><strong>Switch</strong> {switchNameForAp}{ap.switchPort ? ` · ${ap.switchPort}` : ""}</span> : null}{ap.sharesPortWith ? <span><strong>Shared</strong> {ap.sharesPortWith}</span> : null}{ap.rateLimitReference ? <span><strong>Rate limit</strong> {ap.rateLimitReference}</span> : null}{ap.note ? <span>{ap.note}</span> : null}</span><span><button type="button" className="secondary-button" onClick={() => onEdit(ap)}><Pencil size={14} />Edit</button><button type="button" className="secondary-button" disabled={busy === ap._id} onClick={() => onArchive(ap)}><Archive size={14} />Archive</button></span></div>; })}</div>}
  </Card>;
}

function SwitchesTab({ switches, aps, onAdd, onEdit, onArchive, busy }: { switches: ReturnType<typeof useQuery<typeof api.networkSwitches.listSwitches>> | undefined; aps: AccessPointRow[]; onAdd: () => void; onEdit: (item: SwitchRow) => void; onArchive: (item: SwitchRow) => void; busy: string | null }) {
  const apCountBySwitch = new Map<Id<"networkSwitches">, number>();
  for (const ap of aps) { if (ap.switchId) apCountBySwitch.set(ap.switchId, (apCountBySwitch.get(ap.switchId) ?? 0) + 1); }
  const switchRows = switches ?? [];
  return <Card eyebrow="Switched infrastructure" title={`${switchRows.length} registered`} actions={<button type="button" className="primary-button" onClick={onAdd}><Plus size={16} />Add switch</button>}>
    {switchRows.length === 0 ? <p className="dialog-message">No switches are registered for this router. Register a switch when access points hang off a separate device that plugs into one of the router’s ether ports.</p> : <div className="monitor-table"><div className="monitor-head"><span>Name</span><span>Model</span><span>Serial / MAC</span><span>IP</span><span>Router port</span><span>Ports</span><span>APs</span><span /></div>{switchRows.map((entry) => <div key={entry._id} className="monitor-row"><strong>{entry.name}</strong><span>{entry.model ?? "—"}</span><span>{entry.serialNumber || entry.macAddress ? <code>{entry.serialNumber ?? entry.macAddress}</code> : "—"}</span><span>{entry.ipAddress ? <code>{entry.ipAddress}</code> : "—"}</span><span>{entry.routerPort ? <code>{entry.routerPort}</code> : "—"}</span><span>{entry.portCount ? `${entry.portCount}` : "—"}{entry.managed ? <Pill tone="neutral">managed</Pill> : null}</span><span>{apCountBySwitch.get(entry._id) ?? 0}</span><span><button type="button" className="secondary-button" onClick={() => onEdit(entry)}><Pencil size={14} />Edit</button><button type="button" className="secondary-button" disabled={busy === entry._id} onClick={() => onArchive(entry)}><Archive size={14} />Archive</button></span></div>)}</div>}
  </Card>;
}

function DhcpTab({ leases, queues, pools }: { leases: Leases | undefined; queues: Queues | undefined; pools: PoolOverview | undefined }) {
  return <div className="console-grid">
    <section className="section-block console-col">
      <Card eyebrow="DHCP pools" title="Utilization" actions={pools?.observedAt ? <span className="console-note">snapshot {relativeTime(pools.observedAt)}</span> : undefined}>
        {pools === undefined ? <p className="dialog-message">Loading pool data…</p> : pools.totalCapacity === 0 ? <p className="dialog-message">No DHCP pool ranges were found in the latest configuration snapshot. Enable the extended reads on the collector to start syncing them.</p> : <div className="pool-list">{[...pools.pools].map((pool) => <div key={pool.name ?? pool.ranges ?? "pool"} className="pool-row"><div><strong>{pool.name ?? "Pool"}</strong><span>{pool.ranges ?? "—"} · {pool.used}/{pool.capacity} addresses</span></div><UtilizationBar percent={pool.utilization} /></div>)}<div className="pool-total"><span><strong>Total</strong> {pools.totalUsed} of {pools.totalCapacity} addresses in use</span><UtilizationBar percent={pools.utilization} /></div></div>}
      </Card>
    </section>

    <section className="section-block console-col">
      <Card eyebrow="DHCP leases" title={leases !== undefined ? `${leases.length} synced` : "DHCP leases"}>
        {leases === undefined ? <p className="dialog-message">Loading leases…</p> : leases.length === 0 ? <p className="dialog-message">No DHCP leases synced yet. The collector syncs current leases on every run.</p> : <div className="monitor-table"><div className="monitor-head"><span>IP</span><span>MAC</span><span>Hostname</span><span>Status</span><span>Observed</span></div>{leases.map((lease) => <div key={lease._id} className="monitor-row"><strong>{lease.ipAddress}</strong><span><code>{lease.macAddress}</code></span><span>{lease.hostname ?? "—"}</span><span>{lease.status ?? "bound"}</span><span>{relativeTime(lease.observedAt)}</span></div>)}</div>}
      </Card>

      <Card eyebrow="Simple queues" title={queues !== undefined ? `${queues.length} synced` : "Simple queues"}>
        {queues === undefined ? <p className="dialog-message">Loading queues…</p> : queues.length === 0 ? <p className="dialog-message">No simple queues synced for this router.</p> : <div className="monitor-table"><div className="monitor-head"><span>Name</span><span>Target</span><span>Max rate</span><span>State</span><span>Observed</span></div>{queues.map((queue) => <div key={queue._id} className="monitor-row"><strong>{queue.name}</strong><span>{queue.target ?? "—"}</span><span>{queue.maxLimitBps ? rate(queue.maxLimitBps) : "—"}</span><span>{queue.disabled ? <Pill tone="neutral">disabled</Pill> : <Pill tone="success">enabled</Pill>}</span><span>{relativeTime(queue.observedAt)}</span></div>)}</div>}
      </Card>
    </section>
  </div>;
}

type ReadState = { loading?: boolean; data?: unknown; error?: string };

function LiveTab({ routerId }: { routerId: Id<"routers"> }) {
  const getSystemResource = useAction(api.routeros.getSystemResource);
  const getInterfaces = useAction(api.routeros.getInterfaces);
  const getIpAddresses = useAction(api.routeros.getIpAddresses);
  const getEthernet = useAction(api.routeros.getEthernet);
  const getWifi = useAction(api.routeros.getWifi);
  const getBridgeHosts = useAction(api.routeros.getBridgeHosts);
  const getFirewallRules = useAction(api.routeros.getFirewallRules);
  const getIdentity = useAction(api.routeros.getIdentity);
  const getSystemHealth = useAction(api.routeros.getSystemHealth);
  const getHotspotActive = useAction(api.routeros.getHotspotActive);
  const getRoutes = useAction(api.routeros.getRoutes);
  const getDns = useAction(api.routeros.getDns);
  const getIpPools = useAction(api.routeros.getIpPools);
  const getIpPoolUsed = useAction(api.routeros.getIpPoolUsed);
  const getLiveDhcpLeases = useAction(api.routeros.getDhcpLeases);
  const getLiveSimpleQueues = useAction(api.routeros.getSimpleQueues);

  const reads = [
    { key: "resource", label: "System resource", icon: HardDrive, run: () => getSystemResource({ routerId }) },
    { key: "interfaces", label: "Interfaces", icon: Network, run: () => getInterfaces({ routerId }) },
    { key: "ipAddresses", label: "IP addresses", icon: Globe, run: () => getIpAddresses({ routerId }) },
    { key: "ethernet", label: "Ethernet ports", icon: Cable, run: () => getEthernet({ routerId }) },
    { key: "wifi", label: "WiFi radios", icon: Wifi, run: () => getWifi({ routerId }) },
    { key: "bridgeHosts", label: "Bridge hosts", icon: Boxes, run: () => getBridgeHosts({ routerId }) },
    { key: "firewall", label: "Firewall rules", icon: ShieldCheck, run: () => getFirewallRules({ routerId }) },
    { key: "identity", label: "Identity", icon: Fingerprint, run: () => getIdentity({ routerId }) },
    { key: "systemHealth", label: "System health", icon: Zap, run: () => getSystemHealth({ routerId }) },
    { key: "hotspot", label: "Active hotspot", icon: Users, run: () => getHotspotActive({ routerId }) },
    { key: "routes", label: "Routes", icon: Network, run: () => getRoutes({ routerId }) },
    { key: "dns", label: "DNS", icon: Globe, run: () => getDns({ routerId }) },
    { key: "pools", label: "IP pools", icon: Database, run: () => getIpPools({ routerId }) },
    { key: "poolUsed", label: "Pool usage", icon: BarChart3, run: () => getIpPoolUsed({ routerId }) },
    { key: "dhcpLeases", label: "DHCP leases", icon: ListChecks, run: () => getLiveDhcpLeases({ routerId }) },
    { key: "simpleQueues", label: "Simple queues", icon: LayoutGrid, run: () => getLiveSimpleQueues({ routerId }) },
  ] as const;
  type ReadKey = (typeof reads)[number]["key"];

  const [states, setStates] = useState<Record<string, ReadState>>({});
  const [runningAll, setRunningAll] = useState(false);

  const readForKey = (key: ReadKey) => {
    const read = reads.find((item) => item.key === key);
    if (!read) throw new Error("Unknown read");
    return read.run();
  };

  const run = async (keys: ReadKey[]) => {
    setStates((prev) => ({ ...prev, ...Object.fromEntries(keys.map((key) => [key, { loading: true, error: undefined }])) }));
    const settled: Array<{ key: ReadKey; data?: unknown; error?: string }> = [];
    for (const key of keys) {
      try { settled.push({ key, data: await readForKey(key) }); }
      catch (caught) { settled.push({ key, error: errorText(caught) }); }
    }
    setStates((prev) => {
      const next = { ...prev };
      for (const outcome of settled) {
        next[outcome.key] = outcome.error ? { loading: false, error: outcome.error } : { loading: false, data: outcome.data };
      }
      return next;
    });
  };

  const runAll = async () => {
    setRunningAll(true);
    await run(reads.map((item) => item.key));
    setRunningAll(false);
  };
  const runSingle = async (key: ReadKey) => { await run([key]); };

  return <Card eyebrow="Live RouterOS inspection" title="Read-only on-demand reads" actions={<button type="button" className="primary-button" onClick={() => void runAll()} disabled={runningAll}><RefreshCw size={16} />{runningAll ? "Reading…" : "Run all reads"}</button>}>
    <p className="console-note">Each read is a direct GET to the router via the stored read-only credentials. Results are never written back to RouterOS.</p>
    <div className="live-grid">{reads.map((read) => { const Icon = read.icon; const state = states[read.key]; return <article key={read.key} className="workspace-card live-card"><div className="live-card-head"><span><Icon size={17} /></span><h3>{read.label}</h3></div>{state?.loading ? <p className="console-note">Reading…</p> : state?.error ? <p className="console-note" style={{ color: "var(--danger)" }}>{state.error}</p> : state?.data !== undefined ? <JsonViewer value={state.data} compact /> : <p className="console-note">Not run in this session.</p>}<button type="button" className="secondary-button" onClick={() => void runSingle(read.key)} disabled={state?.loading}><RefreshCw size={14} />Run</button></article>; })}</div>
  </Card>;
}

function ConfigTab({ routerId }: { routerId: Id<"routers"> }) {
  return <div className="console-grid">
    <section className="section-block console-col">
      <Card eyebrow="Config watch" title="Baseline & drift detection">
        <ConfigWatchPanel routerId={routerId} />
      </Card>
    </section>
  </div>;
}

function ThresholdsTab({ router, thresholds }: { router: RouterRow; thresholds: ThresholdsRow | null | undefined }) {
  const save = useMutation(api.thresholds.updateRouterMonitorThresholds);
  const [form, setForm] = useState(() => ({
    cpuWarning: String(thresholds?.cpuWarningThreshold ?? 75),
    cpuCritical: String(thresholds?.cpuCriticalThreshold ?? 90),
    memoryWarning: String(thresholds?.memoryWarningThreshold ?? 80),
    memoryCritical: String(thresholds?.memoryCriticalThreshold ?? 90),
  }));
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    setSaved(false);
    setSaving(true);
    try {
      await save({ routerId: router._id, cpuWarningThreshold: Number(form.cpuWarning), cpuCriticalThreshold: Number(form.cpuCritical), memoryWarningThreshold: Number(form.memoryWarning), memoryCriticalThreshold: Number(form.memoryCritical) });
      setSaved(true);
    } catch (caught) { setError(errorText(caught)); } finally { setSaving(false); }
  };

  const field = "mt-1 w-full rounded-md border border-slate-300 px-3 py-2 text-sm outline-none focus:border-orange-600 focus:ring-2 focus:ring-orange-100";
  return <Card eyebrow="Alert thresholds" title="CPU & memory alert levels">
    <p className="console-note">The collector raises a warning incident when a metric crosses its warning threshold and a critical incident at the critical threshold. Incidents resolve automatically when the metric drops back below the threshold.</p>
    <form className="threshold-form" onSubmit={(event) => void submit(event)}>
      {error ? <p className="rounded bg-red-50 p-3 text-sm text-red-800">{error}</p> : null}
      {saved ? <p className="platform-claim-message ok" role="status">Thresholds updated.</p> : null}
      <div className="threshold-grid">
        <label className="text-sm font-medium">CPU warning (%)<input required min="1" max="99" type="number" className={field} value={form.cpuWarning} onChange={(e) => setForm({ ...form, cpuWarning: e.target.value })} /></label>
        <label className="text-sm font-medium">CPU critical (%)<input required min="2" max="100" type="number" className={field} value={form.cpuCritical} onChange={(e) => setForm({ ...form, cpuCritical: e.target.value })} /></label>
        <label className="text-sm font-medium">Memory warning (%)<input required min="1" max="99" type="number" className={field} value={form.memoryWarning} onChange={(e) => setForm({ ...form, memoryWarning: e.target.value })} /></label>
        <label className="text-sm font-medium">Memory critical (%)<input required min="2" max="100" type="number" className={field} value={form.memoryCritical} onChange={(e) => setForm({ ...form, memoryCritical: e.target.value })} /></label>
      </div>
      <button type="submit" className="primary-button" disabled={saving}><SlidersHorizontal size={16} />{saving ? "Saving…" : "Save thresholds"}</button>
    </form>
  </Card>;
}
