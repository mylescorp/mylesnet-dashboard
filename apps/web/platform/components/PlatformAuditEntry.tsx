"use client";

import Link from "next/link";
import { useQuery } from "@/app/lib/convex";
import { platformPanel } from "@/lib/convex/platformPanel";
import { formatDateTime } from "@/shared/components/ui";

function JsonValue({ value }: { value?: string }) {
  if (!value) return <p className="pf-muted">No value recorded.</p>;
  try {
    return <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{JSON.stringify(JSON.parse(value), null, 2)}</pre>;
  } catch {
    return <pre style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{value}</pre>;
  }
}

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
              <div><dt>Entity</dt><dd>{entry.entityTable} · {entry.entityId}</dd></div>
              <div><dt>Changed by</dt><dd>{entry.changedBy}</dd></div>
              <div><dt>Source IP</dt><dd>{entry.ip ?? "Not recorded"}</dd></div>
              <div><dt>Audit record ID</dt><dd><code>{entry._id}</code></dd></div>
              <div><dt>Hash-chain sequence</dt><dd>{entry.chainSequence ?? "Legacy, unsealed"}</dd></div>
              {entry.chainSequence !== undefined ? <>
                <div><dt>Previous hash</dt><dd><code>{entry.prevHash ?? "Missing"}</code></dd></div>
                <div><dt>Entry hash</dt><dd><code>{entry.hash ?? "Missing"}</code></dd></div>
              </> : null}
            </dl>
          </section>
          <section className="pf-panel">
            <div className="section-heading"><div><p className="eyebrow">Change</p><h2>Before and after</h2></div></div>
            <div className="pf-detail-grid">
              <div><h3>Before</h3><JsonValue value={entry.beforeJson} /></div>
              <div><h3>After</h3><JsonValue value={entry.afterJson} /></div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
