"use client";

import { useMemo, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useMutation } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { StatusPill } from "@/shared/components/ui";
import { platformReconciliation, type ReconciliationRun, type ReconciliationRow, type StatementImportRow } from "@/shared/convex/platformReconciliation";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

const ADMIN = ["platform_super_admin", "platform_owner", "platform_admin"];
const FINANCE = ["platform_finance", "finance_manager"];
const money = (minor?: number, currency = "") => minor === undefined ? "—" : `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function parseCsv(source: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let field = ""; let quoted = false;
  for (let i = 0; i < source.length; i++) {
    const ch = source[i]!;
    if (quoted) {
      if (ch === '"' && source[i + 1] === '"') { field += '"'; i++; }
      else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"' && field.length === 0) quoted = true;
    else if (ch === ",") { row.push(field.trim()); field = ""; }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && source[i + 1] === "\n") i++;
      row.push(field.trim()); field = "";
      if (row.some(value => value !== "")) rows.push(row);
      row = [];
    } else field += ch;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field.");
  row.push(field.trim()); if (row.some(value => value !== "")) rows.push(row);
  return rows;
}

function RunStatusPill({ status }: { status: ReconciliationRun["status"] }) {
  const tone = status === "closed" ? "success" : status === "void" ? "danger" : status === "reviewed" ? "warning" : "neutral";
  return <StatusPill tone={tone}>{status}</StatusPill>;
}

function MatchStatusPill({ status }: { status: ReconciliationRun["status"] | ReconciliationRow["matchStatus"] }) {
  const tone = status === "matched" || status === "closed" ? "success" : status === "void" || status === "missing_payment" || status === "duplicate_statement" || status === "ambiguous_payment" ? "danger" : status === "imported" ? "neutral" : "warning";
  return <StatusPill tone={tone}>{status}</StatusPill>;
}

function toImportRows(source: string): StatementImportRow[] {
  const matrix = parseCsv(source);
  if (matrix.length < 2) throw new Error("Add a header row and at least one statement row.");
  const headers = matrix[0]!.map(value => value.toLowerCase().trim());
  const indexes = ["reference", "amount", "currency", "settled_at"].map(name => headers.indexOf(name));
  if (indexes.some(index => index < 0)) throw new Error("CSV headers must include reference, amount, currency, settled_at.");
  if (matrix.length > 501) throw new Error("Import is limited to 500 statement rows.");
  return matrix.slice(1).map((values, index) => ({ rowNumber: index + 2, reference: values[indexes[0]!] ?? "", amount: values[indexes[1]!] ?? "", currency: values[indexes[2]!] ?? "", settledAt: values[indexes[3]!] ?? "" }));
}

export function PlatformPaymentReconciliation() {
  const { user } = useUserProfile();
  const roles = user?.roles.map(role => role.slug) ?? [];
  const canImport = roles.some(role => [...ADMIN, ...FINANCE].includes(role));
  const [gateway, setGateway] = useState(""); const [statementName, setStatementName] = useState(""); const [csv, setCsv] = useState("");
  const [selected, setSelected] = useState<ReconciliationRun | null>(null); const [error, setError] = useState(""); const [notice, setNotice] = useState(""); const [busy, setBusy] = useState(false);
  const { results: runs, status: runStatus, loadMore: loadMoreRuns } = usePaginatedQuery(platformReconciliation.listRuns, {}, { initialNumItems: 20 });
  const { results: rows, status: rowStatus, loadMore: loadMoreRows } = usePaginatedQuery(platformReconciliation.listRows, selected ? { runId: selected._id } : "skip", { initialNumItems: 50 });
  const importStatement = useMutation(platformReconciliation.importStatement); const updateStatus = useMutation(platformReconciliation.updateRunStatus);
  const exceptionCount = useMemo(() => rows?.filter(row => row.matchStatus !== "matched").length ?? 0, [rows]);
  const submitImport = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError(""); setNotice("");
    try {
      const result = await importStatement({ gateway, statementName, rows: toImportRows(csv) });
      setNotice(`Imported ${result.rowCount} rows: ${result.matchedCount} matched, ${result.exceptionCount} need review.`); setStatementName(""); setCsv("");
    } catch (cause) { setError(userFacingMessage(cause, "Statement import failed.")); }
    finally { setBusy(false); }
  };
  const transition = async (run: ReconciliationRun, status: ReconciliationRun["status"]) => {
    const promptedReason = status === "void" ? window.prompt("Reason for voiding this financial record (8–500 characters):") : undefined;
    if (promptedReason === null) return;
    const reason = typeof promptedReason === "string" ? promptedReason : undefined;
    setBusy(true); setError(""); setNotice("");
    try { await updateStatus({ runId: run._id, status, ...(reason === undefined ? {} : { reason }) }); setNotice(`Statement ${status}.`); }
    catch (cause) { setError(userFacingMessage(cause, "The reconciliation status could not be changed.")); }
    finally { setBusy(false); }
  };
  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform billing oversight</p><h1 className="page-title">Payment reconciliation</h1><p className="page-subtitle">Import provider settlement statements and compare references, amounts, currencies, and payment status with tenant payment records.</p></div></header>
    <p className="pf-hint">Manual CSV import only. This does not connect to a gateway or move funds. Each imported statement is retained as financial evidence; correct source payments through their normal audited workflow.</p>
    {error && <p className="platform-claim-message" role="alert">{error}</p>}{notice && <p className="platform-notice" role="status">{notice}</p>}
    {canImport && <form className="pf-panel" onSubmit={submitImport}>
      <h2>Import settlement CSV</h2><p className="pf-hint">Required columns: <code>reference,amount,currency,settled_at</code>. Up to 500 rows per import. Amounts use major currency units.</p>
      <div className="pf-form-grid"><label className="pf-field"><span className="pf-label">Gateway</span><input className="pf-input" required maxLength={80} value={gateway} onChange={e => setGateway(e.target.value)} placeholder="e.g. M-Pesa" /></label><label className="pf-field"><span className="pf-label">Statement name</span><input className="pf-input" required maxLength={160} value={statementName} onChange={e => setStatementName(e.target.value)} placeholder="Settlement report date or reference" /></label></div>
      <label className="pf-field"><span className="pf-label">CSV file</span><input className="pf-input" type="file" accept=".csv,text/csv" onChange={async e => { const file = e.target.files?.[0]; if (file) setCsv(await file.text()); }} /></label>
      <label className="pf-field"><span className="pf-label">Statement data</span><textarea className="pf-input" rows={7} required value={csv} onChange={e => setCsv(e.target.value)} placeholder={'reference,amount,currency,settled_at\nABC123,100.00,KES,2026-10-07T10:00:00Z'} /></label>
      <button className="primary-button" disabled={busy || !csv.trim()}>{busy ? "Importing…" : "Import and reconcile"}</button>
    </form>}
    <section className="section-heading"><div><p className="eyebrow">Settlement records</p><h2>Statement imports</h2></div><span className="section-count">{runs?.length ?? 0} loaded</span></section>
    {!runs?.length && runStatus !== "LoadingFirstPage" ? <p className="pf-hint">No settlement statements have been imported.</p> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Statement</th><th>Gateway</th><th>Imported</th><th>Rows</th><th>Matched</th><th>Exceptions</th><th>Status</th><th /></tr></thead><tbody>{runs?.map(run => <tr key={run._id}><td>{run.statementName}</td><td>{run.gateway}</td><td>{new Date(run.importedAt).toLocaleString()}</td><td>{run.rowCount}</td><td>{run.matchedCount}</td><td>{run.exceptionCount}</td><td><RunStatusPill status={run.status} /></td><td><button className="secondary-button" onClick={() => setSelected(run)}>Review</button>{canImport && run.status === "imported" && <button className="secondary-button" disabled={busy} onClick={() => transition(run, "reviewed")}>Mark reviewed</button>}{canImport && run.status === "reviewed" && <button className="secondary-button" disabled={busy} onClick={() => transition(run, "closed")}>Close</button>}{canImport && run.status !== "void" && <button className="secondary-button" disabled={busy} onClick={() => transition(run, "void")}>Void</button>}</td></tr>)}</tbody></table></div>}
    {runStatus === "CanLoadMore" && <button className="secondary-button" onClick={() => loadMoreRuns(20)}>Load more statements</button>}
    {selected && <section className="pf-panel" style={{ marginTop: 24 }}><div className="section-heading"><div><p className="eyebrow">{selected.statementName}</p><h2>Statement row review</h2></div><button className="secondary-button" onClick={() => setSelected(null)}>Close</button></div><p className="pf-hint">{exceptionCount} exceptions in loaded rows. Payment and statement records are immutable after import.</p><div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Row</th><th>Reference</th><th>Tenant</th><th>Statement</th><th>Internal payment</th><th>Match result</th><th>Settled at</th></tr></thead><tbody>{rows?.map(row => <tr key={row._id}><td>{row.rowNumber}</td><td><code>{row.reference}</code></td><td>{row.tenantName ?? "—"}</td><td>{money(row.statementAmountMinor, row.statementCurrency)}</td><td>{money(row.internalAmountMinor, row.internalCurrency)}{row.internalPaymentStatus ? ` · ${row.internalPaymentStatus}` : ""}</td><td><MatchStatusPill status={row.matchStatus} /></td><td>{new Date(row.settledAt).toLocaleString()}</td></tr>)}</tbody></table></div>{rowStatus === "CanLoadMore" && <button className="secondary-button" onClick={() => loadMoreRows(50)}>Load more rows</button>}</section>}
  </main>;
}
