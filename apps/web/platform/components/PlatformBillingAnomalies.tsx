"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useMutation } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { StatusPill } from "@/shared/components/ui";
import { platformBillingAnomalies, type PlatformBillingAnomaly } from "@/shared/convex/platformBillingAnomalies";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

const WRITE_ROLES = ["platform_super_admin", "platform_ops", "platform_owner", "platform_admin", "ops_manager"];
const TITLES: Record<PlatformBillingAnomaly["anomalyType"], string> = {
  stale_pending: "Stale pending payment",
  duplicate_reference: "Duplicate gateway reference",
  invoice_status_mismatch: "Payment and invoice status differ",
  negative_amount: "Negative payment amount",
};
const money = (amount: number, currency: string) => `${currency} ${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
export function PlatformBillingAnomalies() {
  const { user } = useUserProfile();
  const roles = user?.roles.map(role => role.slug) ?? [];
  const canReview = roles.some(role => WRITE_ROLES.includes(role));
  const [days, setDays] = useState(30);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const { results, status, loadMore } = usePaginatedQuery(platformBillingAnomalies.list, { days }, { initialNumItems: 30 });
  const review = useMutation(platformBillingAnomalies.review);
  const update = async (row: PlatformBillingAnomaly, nextStatus: PlatformBillingAnomaly["status"]) => {
    const noteInput = document.getElementById(`anomaly-note-${row.key}`) as HTMLTextAreaElement | null;
    setBusy(row.key); setError(""); setNotice("");
    try {
      await review({ paymentId: row.paymentId, anomalyType: row.anomalyType, status: nextStatus, note: noteInput?.value.trim() || null });
      setNotice(`${TITLES[row.anomalyType]} marked ${nextStatus}.`);
    } catch (cause) { setError(userFacingMessage(cause, "The anomaly review could not be saved.")); }
    finally { setBusy(null); }
  };
  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform billing oversight</p><h1 className="page-title">Billing anomalies</h1><p className="page-subtitle">Review suspicious or inconsistent payment records across tenant workspaces.</p></div><label className="pf-field"><span className="pf-label">Lookback</span><select className="pf-input" value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 days</option><option value={30}>30 days</option><option value={90}>90 days</option></select></label></header>
    <p className="pf-hint">Signals use recorded payment and invoice data: pending payments older than 24 hours, duplicate gateway/reference pairs, completed payments linked to non-paid invoices, and negative amounts. This deployment has no RADIUS session-history source; session-to-billing correlation is unavailable and is never inferred. Finance can read findings; platform super-admin and ops can acknowledge, resolve, or reopen them.</p>
    {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Cross-tenant findings</p><h2>Payment review queue</h2></div><span className="section-count">{results.length} loaded</span></div>
      {status === "LoadingFirstPage" ? <p className="pf-muted">Scanning recent payment records…</p> : results.length === 0 ? <p className="pf-muted">No billing anomalies were found in the selected window.</p> : <div className="pf-stack">{results.map(row => <article key={row.key} className="pf-panel" style={{ padding: 16 }}><div className="section-heading"><div><p className="eyebrow">{row.tenantName ?? "Tenant unavailable"} · {row.gateway}</p><h3>{TITLES[row.anomalyType]}</h3></div><StatusPill tone={row.status === "resolved" ? "success" : row.status === "open" ? "warning" : "neutral"}>{row.status}</StatusPill></div><dl className="pf-detail-grid"><div><dt>Payment</dt><dd>{money(row.amount, row.currency)} · {row.paymentStatus}</dd></div><div><dt>Reference</dt><dd>{row.reference || "None"}</dd></div><div><dt>Payment time</dt><dd>{new Date(row.paymentDate).toLocaleString()}</dd></div><div><dt>Invoice state</dt><dd>{row.invoiceStatus ?? "Not linked / unavailable"}</dd></div><div><dt>Session correlation</dt><dd>Unavailable</dd></div></dl>{canReview ? <><label className="pf-field"><span className="pf-label">Review note</span><textarea id={`anomaly-note-${row.key}`} className="pf-input" maxLength={1000} defaultValue={row.note ?? ""} /></label><div className="modal-actions"><button type="button" className="secondary-button" disabled={busy === row.key || row.status === "acknowledged"} onClick={() => void update(row, "acknowledged")}>Acknowledge</button><button type="button" className="primary-button" disabled={busy === row.key || row.status === "resolved"} onClick={() => void update(row, "resolved")}>Resolve</button>{row.status !== "open" ? <button type="button" className="secondary-button" disabled={busy === row.key} onClick={() => void update(row, "open")}>Reopen</button> : null}</div></> : row.note ? <p className="pf-hint">Review note: {row.note}</p> : null}</article>)}</div>}
      {status === "CanLoadMore" || status === "LoadingMore" ? <div className="modal-actions"><button type="button" className="secondary-button" disabled={status === "LoadingMore"} onClick={() => loadMore(30)}>{status === "LoadingMore" ? "Loading…" : "Load more findings"}</button></div> : null}
    </section>
  </main>;
}
