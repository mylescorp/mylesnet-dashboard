"use client";

import { useQuery } from "@/app/lib/convex";
import { useMemo, useState } from "react";
import { Activity, ListChecks, RadioTower } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";

function relativeTime(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return new Date(timestamp).toLocaleString();
}

const typeLabels: Record<string, string> = {
  ingest_latency: "Ingest latency",
  rate_limited: "Rate limited",
  dropped: "Event dropped",
  collector_backoff: "Collector backoff",
  partial_telemetry: "Partial telemetry",
};

type Event = NonNullable<NonNullable<ReturnType<typeof useQuery<typeof api.operations.getRecentSystemEvents>>>>[number];

const filterOptions: Array<{ value: "all" | "warning" | "critical"; label: string }> = [
  { value: "all", label: "All" },
  { value: "warning", label: "Warning+" },
  { value: "critical", label: "Critical only" },
];

export default function TelemetryHealthPage() {
  const limit = 60;
  const events = useQuery(api.operations.getRecentSystemEvents, { limit });
  const [filter, setFilter] = useState<"all" | "warning" | "critical">("all");
  const filtered = useMemo(() => {
    if (events === undefined) return undefined;
    if (filter === "all") return events;
    const wanted = filter === "critical" ? ["critical"] : ["warning", "critical"];
    return events.filter((event) => wanted.includes(event.severity));
  }, [events, filter]);
  const bodyKpis = useMemo(() => {
    if (events === undefined) return null;
    const counts = { info: 0, warning: 0, critical: 0 };
    for (const event of events) counts[event.severity] += 1;
    return counts;
  }, [events]);

  if (events === undefined || filtered === undefined) {
    return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading telemetry health…</div></div>;
  }
  return <div className="workspace-page"><header className="page-heading"><div><p className="eyebrow">Network operations · Monitoring</p><h1 className="page-title">Telemetry health</h1><p className="page-subtitle">Self-reported problems raised by the collector and ingest path — round-trip latency, rate limiting, dropped events, backoff, and partial telemetry.</p></div></header>
    <section className="router-console-kpis">
      <div className="operations-kpi"><span><ListChecks size={14} /></span><p>Read window</p><strong>{limit}</strong><small>Most recent events</small></div>
      <div className="operations-kpi"><span><RadioTower size={14} /></span><p>Info</p><strong>{bodyKpis?.info ?? 0}</strong><small>No action needed</small></div>
      <div className="operations-kpi"><span><ListChecks size={14} /></span><p>Warnings</p><strong>{bodyKpis?.warning ?? 0}</strong><small>Inspect if repeated</small></div>
      <div className="operations-kpi"><span><ListChecks size={14} /></span><p>Critical</p><strong>{bodyKpis?.critical ?? 0}</strong><small>Needs attention</small></div>
    </section>
    <section className="workspace-card console-card"><div className="section-heading"><div><p className="eyebrow">Event feed</p><h2>System events</h2></div><div className="filter-group">{filterOptions.map((option) => <button key={option.value} type="button" className={`filter-button ${filter === option.value ? "filter-button-active" : ""}`} onClick={() => setFilter(option.value)}>{option.label}</button>)}</div></div>
      {filtered.length === 0 ? <p className="dialog-message">No {filter === "all" ? "" : `${filter} `}events in the read window. A healthy deployment is quiet — if you expect event flow, this usually means the collector has not run yet.</p> : <div className="monitor-table"><div className="monitor-head"><span>Time</span><span>Event</span><span>Router</span></div>{filtered.map((event) => <EventRow key={event._id} event={event} />)}</div>}
    </section>
  </div>;
}

function severityPill(severity: Event["severity"]) {
  const map: Record<Event["severity"], string> = {
    info: "status-pill-neutral",
    warning: "status-pill-warning",
    critical: "status-pill-danger",
  };
  const label = { info: "Info", warning: "Warning", critical: "Critical" }[severity];
  return <span className={`status-pill ${map[severity]}`}>{label}</span>;
}

function EventRow({ event }: { event: Event }) {
  return <div className="monitor-row"><span>{relativeTime(event.occurredAt)}</span><span className="monitor-cell-stack-a"><span className="monitor-cell-line"><strong>{typeLabels[event.type] ?? event.type}</strong>{severityPill(event.severity)}</span><span className="monitor-cell-line">{event.title}</span>{event.details ? <small>{event.details}</small> : null}</span><span>{event.routerName ? <Link href={`/routers/${event.routerId}`} className="hover:text-orange-700">{event.routerName}</Link> : <em>network-wide</em>}</span></div>;
}
