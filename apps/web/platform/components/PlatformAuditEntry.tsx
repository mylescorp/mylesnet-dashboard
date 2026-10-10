"use client";

import Link from "next/link";
import { useQuery } from "@/app/lib/convex";
import { platformPanel } from "@/lib/convex/platformPanel";
import { formatDateTime } from "@/shared/components/ui";

export function PlatformAuditEntry({ auditId }: { auditId: string }) {
  const entry = useQuery(platformPanel.getAuditLogEntry, { auditId });

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Audit entry</h1>
          <p className="page-subtitle">Read-only record from the append-only platform audit history.</p>
        </div>
        <Link className="secondary-button" href="/platform/audit-log">Back to audit log</Link>
      </header>
      {entry === undefined ? <section className="pf-panel"><p className="pf-muted">Loading audit entry…</p></section> : entry === null ? (
        <section className="pf-panel"><h2>Entry unavailable</h2><p className="pf-muted">The audit record does not exist or is no longer available.</p></section>
      ) : (
        <>
          <section className="pf-panel">
            <div className="section-heading"><div><p className="eyebrow">Event</p><h2><code>{entry.action}</code></h2></div></div>
            <dl className="pf-detail-grid">
              <div><dt>Timestamp</dt><dd>{formatDateTime(entry.timestamp)}</dd></div>
              <div><dt>Entity type</dt><dd>{entry.entityTable.replace(/([A-Z])/g, " $1")}</dd></div>
              <div><dt>Record</dt><dd>{entry.entityLabel}</dd></div>
              <div><dt>Actor</dt><dd>{entry.actorName}</dd></div>
            </dl>
          </section>
          <section className="pf-panel"><p className="pf-muted">Detailed record values are restricted to authorized audit exports.</p></section>
        </>
      )}
    </div>
  );
}
