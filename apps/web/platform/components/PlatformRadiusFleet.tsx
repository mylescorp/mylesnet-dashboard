"use client";

import { useState, type FormEvent } from "react";
import { usePaginatedQuery } from "convex/react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { platformRadius, type PlatformRadiusRow } from "@/shared/convex/platformRadius";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

type RadiusForm = { name: string; hostname: string; region: string; authPort: string; accountingPort: string; transport: PlatformRadiusRow["transport"]; softwareVersion: string; lifecycleStatus: PlatformRadiusRow["lifecycleStatus"]; capacitySessions: string };
const fresh = (): RadiusForm => ({ name: "", hostname: "", region: "", authPort: "1812", accountingPort: "1813", transport: "udp", softwareVersion: "", lifecycleStatus: "planned", capacitySessions: "" });
const metric = (value: number | null, suffix = "") => value === null ? "Not reported" : `${value}${suffix}`;

export function PlatformRadiusFleet({ canManage }: { canManage: boolean }) {
  const { results, status, loadMore } = usePaginatedQuery(platformRadius.list, { includeArchived: true }, { initialNumItems: 20 });
  const createServer = useMutation(platformRadius.create); const updateServer = useMutation(platformRadius.update);
  const archiveServer = useMutation(platformRadius.archive); const restoreServer = useMutation(platformRadius.restore);
  const [form, setForm] = useState(fresh()); const [editing, setEditing] = useState<string | null>(null);
  const editDetails = useQuery(platformRadius.get, editing ? { serverId: editing } : "skip");
  const [busy, setBusy] = useState(false); const [error, setError] = useState("");

  function edit(row: PlatformRadiusRow) {
    setEditing(row._id); setForm({ name: row.name, hostname: "", region: row.region, authPort: "", accountingPort: "", transport: row.transport, softwareVersion: row.softwareVersion ?? "", lifecycleStatus: row.lifecycleStatus, capacitySessions: row.capacitySessions === null ? "" : String(row.capacitySessions) });
  }
  async function save(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const values = { name: form.name, hostname: form.hostname || editDetails?.hostname || "", region: form.region, authPort: Number(form.authPort || editDetails?.authPort), accountingPort: Number(form.accountingPort || editDetails?.accountingPort), transport: form.transport, lifecycleStatus: form.lifecycleStatus };
    try {
      if (editing) await updateServer({ serverId: editing, ...values, softwareVersion: form.softwareVersion || null, capacitySessions: form.capacitySessions ? Number(form.capacitySessions) : null });
      else await createServer({ ...values, ...(form.softwareVersion ? { softwareVersion: form.softwareVersion } : {}), ...(form.capacitySessions ? { capacitySessions: Number(form.capacitySessions) } : {}) });
      setEditing(null); setForm(fresh());
    } catch (caught) { setError(userFacingMessage(caught, "RADIUS server details could not be saved.")); }
    finally { setBusy(false); }
  }
  async function archive(row: PlatformRadiusRow) {
    const reason = window.prompt("Reason for archiving this RADIUS server:"); if (!reason) return;
    setBusy(true); setError("");
    try { await archiveServer({ serverId: row._id, reason }); }
    catch (caught) { setError(userFacingMessage(caught, "RADIUS server could not be archived.")); }
    finally { setBusy(false); }
  }
  async function restore(row: PlatformRadiusRow) {
    setBusy(true); setError("");
    try { await restoreServer({ serverId: row._id }); }
    catch (caught) { setError(userFacingMessage(caught, "RADIUS server could not be restored.")); }
    finally { setBusy(false); }
  }

  return <div className="pf-stack">
    <header className="page-header"><div><p className="eyebrow">Network infrastructure</p><h1>RADIUS server fleet</h1><p className="page-subtitle">Manage shared RADIUS node inventory. Live health metrics remain unavailable until the trusted network telemetry integration is connected.</p></div></header>
    {error && <p className="pf-error" role="alert">{error}</p>}
    {editing && !editDetails && <p className="pf-muted" role="status">Loading connection settings…</p>}
    {canManage && (!editing || editDetails) && <form className="pf-panel pf-stack" onSubmit={save}><h2>{editing ? "Edit RADIUS server" : "Register RADIUS server"}</h2><div className="pf-grid"><label className="pf-field"><span className="pf-label">Name</span><input required maxLength={100} className="pf-input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label><label className="pf-field"><span className="pf-label">Hostname or IPv4</span><input required maxLength={253} className="pf-input" value={form.hostname || editDetails?.hostname || ""} onChange={e => setForm({ ...form, hostname: e.target.value })} /></label><label className="pf-field"><span className="pf-label">Region</span><input required maxLength={100} className="pf-input" value={form.region} onChange={e => setForm({ ...form, region: e.target.value })} /></label><label className="pf-field"><span className="pf-label">Transport</span><select className="pf-input" value={form.transport} onChange={e => setForm({ ...form, transport: e.target.value as typeof form.transport })}><option value="udp">UDP</option><option value="tcp">TCP</option><option value="tls">TLS</option></select></label><label className="pf-field"><span className="pf-label">Auth port</span><input required type="number" min="1" max="65535" className="pf-input" value={form.authPort || editDetails?.authPort || ""} onChange={e => setForm({ ...form, authPort: e.target.value })} /></label><label className="pf-field"><span className="pf-label">Accounting port</span><input required type="number" min="1" max="65535" className="pf-input" value={form.accountingPort || editDetails?.accountingPort || ""} onChange={e => setForm({ ...form, accountingPort: e.target.value })} /></label><label className="pf-field"><span className="pf-label">Software version (optional)</span><input maxLength={80} className="pf-input" value={form.softwareVersion} onChange={e => setForm({ ...form, softwareVersion: e.target.value })} /></label><label className="pf-field"><span className="pf-label">Session capacity (optional)</span><input type="number" min="1" max="100000000" className="pf-input" value={form.capacitySessions} onChange={e => setForm({ ...form, capacitySessions: e.target.value })} /></label><label className="pf-field"><span className="pf-label">Lifecycle</span><select className="pf-input" value={form.lifecycleStatus} onChange={e => setForm({ ...form, lifecycleStatus: e.target.value as PlatformRadiusRow["lifecycleStatus"] })}>{["planned", "active", "degraded", "maintenance", "retired"].map(status => <option key={status}>{status}</option>)}</select></label></div><div className="pf-actions"><button className="primary-button" disabled={busy || (Boolean(editing) && !editDetails)}>{busy ? "Saving…" : editing ? "Save changes" : "Register server"}</button>{editing && <button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm(fresh()); }}>Cancel</button>}</div><p className="pf-hint">Connection details appear only in this role-restricted edit form. Do not enter RADIUS shared secrets or management credentials here.</p></form>}
    <section className="pf-panel"><h2>Shared RADIUS nodes</h2>{status === "LoadingFirstPage" ? <p>Loading servers…</p> : results.length === 0 ? <p>No RADIUS servers registered.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Server</th><th>Lifecycle</th><th>Uptime</th><th>Latency</th><th>Sessions</th><th>Auth success / failure</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{results.map(row => <tr key={row._id} style={row.archivedAt ? { opacity: 0.65 } : undefined}><td>{row.name}<br /><small>{row.region} · {row.transport.toUpperCase()} · {row.softwareVersion ?? "version unknown"}</small></td><td>{row.archivedAt ? "Archived" : row.lifecycleStatus}</td><td>{metric(row.uptimePercent, "%")}</td><td>{metric(row.latencyMs, " ms")}</td><td>{metric(row.activeSessions)}</td><td>{metric(row.authSuccessPercent, "%")} / {metric(row.authFailurePercent, "%")}{row.metricsObservedAt !== null && <small><br />Updated {new Date(row.metricsObservedAt).toLocaleString()}</small>}</td>{canManage && <td>{row.archivedAt ? <button className="secondary-button" disabled={busy} onClick={() => void restore(row)}>Restore</button> : <><button className="secondary-button" disabled={busy} onClick={() => edit(row)}>Edit</button> <button className="secondary-button" disabled={busy} onClick={() => void archive(row)}>Archive</button></>}</td>}</tr>)}</tbody></table></div>}{status === "CanLoadMore" && <button className="secondary-button" onClick={() => loadMore(20)}>Load more</button>}</section>
  </div>;
}
