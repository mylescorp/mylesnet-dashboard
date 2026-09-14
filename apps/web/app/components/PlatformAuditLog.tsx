"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { platformPanel, type AuditLogEntry } from "@/lib/convex/platformPanel";
import { formatDateTime } from "./ui";

export function PlatformAuditLog() {
  const [entityTable, setEntityTable] = useState<string | undefined>(undefined);
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.length > 0 ? cursors[cursors.length - 1] : null;

  const audit = useQuery(platformPanel.listAuditLogPage, { entityTable, limit: 25, cursor });
  const tables = useQuery(platformPanel.listAuditEntityTables, {});
  const chain = useQuery(platformPanel.getAuditChainHealth, {});
  const entityTables = tables ?? [];

  const goForward = () => { if (audit?.nextCursor) setCursors((prev) => [...prev, audit.nextCursor!]); };
  const goBack = () => setCursors((prev) => prev.slice(0, -1));

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">Paginated, read-only log of every audited entity change across the platform. Filter by entity type or browse chronologically.</p>
        </div>
      </header>

      <section className="pf-panel" aria-live="polite">
        <div className="section-heading"><div><p className="eyebrow">Integrity</p><h2>Audit-chain verification</h2></div></div>
        {chain === undefined ? <p className="pf-muted">Checking the latest sealed audit entries…</p> : chain.sealedEntries === 0 ? (
          <p className="pf-muted">No sealed entries yet. Historical audit records remain available and are clearly treated as pre-seal history.</p>
        ) : (
          <p className={chain.valid ? "pf-muted" : "form-error"}>
            {chain.valid
              ? `Verified ${chain.checkedEntries} sealed ${chain.checkedEntries === 1 ? "entry" : "entries"}${chain.windowLimited ? ` in the most recent ${chain.windowSize}-entry window` : ""}.`
              : `Integrity check failed: ${chain.issue?.replace("_", " ") ?? "unknown verification error"}. Investigate before relying on this audit history.`}
            {chain.legacyEntriesInWindow > 0 ? ` ${chain.legacyEntriesInWindow} pre-seal ${chain.legacyEntriesInWindow === 1 ? "entry is" : "entries are"} preserved outside the hash chain.` : ""}
          </p>
        )}
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Controls</p><h2>Filter</h2></div></div>
        <label className="pf-field" style={{ maxWidth: 260 }}>
          <span className="pf-label">Entity table</span>
          <select className="pf-input" value={entityTable ?? ""} onChange={(event) => { const value = event.target.value || undefined; setEntityTable(value); setCursors([]); }}>
            <option value="">All entities</option>
            {entityTables.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Entries</p><h2>Change history</h2></div><span className="section-count">{audit?.items.length ?? 0} in this page</span></div>
        {audit === undefined ? <p className="pf-muted">Loading audit log…</p> : audit.items.length === 0 ? <p className="pf-muted">No audit entries match the current filter.</p> : (
          <>
            <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Timestamp</th><th>Action</th><th>Entity</th><th>Changed by</th><th>IP</th></tr></thead><tbody>
              {audit.items.map((entry: AuditLogEntry) => (
                <tr key={entry._id}>
                  <td>{formatDateTime(entry.timestamp)}</td>
                  <td><code>{entry.action}</code></td>
                  <td><span className="table-subtext">{entry.entityTable}</span>{entry.entityId}</td>
                  <td><span className="table-subtext">{entry.changedBy}</span></td>
                  <td><span className="table-subtext">{entry.ip ?? "—"}</span></td>
                </tr>
              ))}
            </tbody></table></div>
            <div className="audit-pagination">
              <button type="button" className="secondary-button" disabled={cursors.length === 0} onClick={goBack}>Previous</button>
              <button type="button" className="secondary-button" disabled={!audit.nextCursor} onClick={goForward}>Next</button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
