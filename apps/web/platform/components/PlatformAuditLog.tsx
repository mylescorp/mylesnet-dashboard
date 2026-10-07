"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { platformPanel, type AuditLogEntry } from "@/lib/convex/platformPanel";
import { formatDateTime } from "@/shared/components/ui";

export function PlatformAuditLog() {
  const [cursors, setCursors] = useState<string[]>([]);
  const cursor = cursors.length > 0 ? cursors[cursors.length - 1] : null;

  const audit = useQuery(platformPanel.listAuditLogPage, { limit: 25, cursor });
  const chain = useQuery(platformPanel.getAuditChainHealth, {});

  const goForward = () => { if (audit?.nextCursor) setCursors((previous) => [...previous, audit.nextCursor!]); };
  const goBack = () => setCursors((previous) => previous.slice(0, -1));

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Audit log</h1>
          <p className="page-subtitle">Read-only record of platform activity, listed by date.</p>
        </div>
      </header>

      <section className="pf-panel" aria-live="polite">
        <div className="section-heading"><div><p className="eyebrow">Integrity</p><h2>Activity record status</h2></div></div>
        {chain === undefined ? <p className="pf-muted">Checking activity record status…</p> : chain.status === "never" ? (
          <p className="pf-muted">A full integrity check has not run yet.</p>
        ) : chain.status === "running" ? (
          <p className="pf-muted">
            Integrity check in progress since {formatDateTime(chain.runningSince ?? undefined)}.
          </p>
        ) : chain.status === "completed" ? (
          <p className="pf-muted">
            Activity records passed the integrity check. Last checked {formatDateTime(chain.completedAt ?? undefined)}.
          </p>
        ) : (
          <p className="form-error">
            Activity record integrity could not be confirmed. Please contact support.
            {chain.lastGoodAt ? ` Last clean sweep completed ${formatDateTime(chain.lastGoodAt)}.` : ""}
          </p>
        )}
      </section>

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Entries</p><h2>Change history</h2></div><span className="section-count">{audit?.items.length ?? 0} in this page</span></div>
        {audit === undefined ? <p className="pf-muted">Loading audit log…</p> : audit.items.length === 0 ? <p className="pf-muted">No audit entries match the current filter.</p> : (
          <>
            <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Timestamp</th><th>Activity</th><th>Integrity</th></tr></thead><tbody>
              {audit.items.map((entry: AuditLogEntry) => (
                <tr key={entry._id}>
                  <td>{formatDateTime(entry.timestamp)}</td>
                  <td>Activity recorded</td>
                  <td>{"Recorded"}</td>
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
