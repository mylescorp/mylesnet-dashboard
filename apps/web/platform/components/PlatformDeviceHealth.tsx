"use client";

import { useMemo } from "react";
import { usePaginatedQuery } from "convex/react";
import Link from "next/link";
import { fleet } from "@/lib/convex/fleet";
import { EmptyState, StatusPill } from "@/shared/components/ui";

const provisioningTone = { provisioned: "success", pending: "warning", failed: "danger", unprovisioned: "neutral" } as const;

export function PlatformDeviceHealth() {
  const { results, status, loadMore } = usePaginatedQuery(fleet.list, { includeArchived: false }, { initialNumItems: 50 });
  const summary = useMemo(() => ({ devices: results.length, lastSeenReported: results.filter(row => row.lastSeenAt !== null).length, uptimeReported: results.filter(row => row.uptimePercent !== null).length }), [results]);

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform infrastructure</p><h1 className="page-title">Device health</h1><p className="page-subtitle">Cross-tenant view of the device status and health fields currently recorded in the fleet registry. Updates appear reactively when registry data changes.</p></div><StatusPill tone="warning">Telemetry incomplete</StatusPill></header>
    <p className="pf-hint">The current data model records last-seen and uptime fields but has no raw health-sample ingestion path. Blank values mean no health reading is recorded; this page does not infer online/offline thresholds.</p>
    <section className="metric-grid" aria-label="Loaded health records"><Metric label="Devices loaded" value={summary.devices} /><Metric label="Last seen recorded" value={`${summary.lastSeenReported}/${summary.devices}`} /><Metric label="Uptime recorded" value={`${summary.uptimeReported}/${summary.devices}`} /></section>
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Fleet status</p><h2>Recorded device health</h2></div><span className="section-count">{summary.devices} loaded</span></div>
      {status === "LoadingFirstPage" ? <p className="pf-muted">Loading device health…</p> : results.length === 0 ? <EmptyState title="No devices in the fleet" body="Registered devices will appear here when available." /> : <div className="table-scroll"><table className="pf-table"><thead><tr><th>Device</th><th>Tenant</th><th>Market</th><th>Provisioning</th><th>Last seen</th><th>Uptime</th></tr></thead><tbody>{results.map(row => <tr key={row._id}><td><Link href={`/platform/infrastructure/devices/${row._id}`} className="tenant-name-link"><strong>{row.name}</strong></Link><small className="table-subtext">{row.deviceKind}</small></td><td>{row.tenantName ?? "Unassigned"}</td><td>{row.marketName ?? "Unknown market"}</td><td><StatusPill tone={provisioningTone[row.provisioningStatus ?? "unprovisioned"]}>{row.provisioningStatus ?? "unprovisioned"}</StatusPill></td><td>{row.lastSeenAt === null ? <span className="pf-muted">No reading</span> : new Date(row.lastSeenAt).toISOString()}</td><td>{row.uptimePercent === null ? <span className="pf-muted">No reading</span> : `${row.uptimePercent}%`}</td></tr>)}</tbody></table></div>}
      {status === "CanLoadMore" || status === "LoadingMore" ? <div className="modal-actions"><button type="button" className="secondary-button" disabled={status === "LoadingMore"} onClick={() => loadMore(50)}>{status === "LoadingMore" ? "Loading…" : "Load more devices"}</button></div> : null}
    </section>
  </main>;
}

function Metric({ label, value }: { label: string; value: number | string }) { return <div className="metric-card"><p className="metric-label">{label}</p><p className="metric-value">{value}</p><p className="metric-detail">in loaded device rows</p></div>; }
