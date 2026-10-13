"use client";

import { useState } from "react";
import Link from "next/link";
import { usePaginatedQuery } from "convex/react";
import { CheckCircle2, Clock3, HandCoins } from "lucide-react";
import { api } from "@/convex/_generated/api";
import { useMutation } from "@/shared/lib/convex";
import { EmptyState, Loading, Select, StatusPill, formatDateTime } from "@/shared/components/ui";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

type PayoutStatus = "pending_approval" | "approved" | "processing" | "paid" | "rejected";
const statusInfo: Record<PayoutStatus, { tone: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  pending_approval: { tone: "warning", label: "Pending approval" },
  approved: { tone: "neutral", label: "Approved" },
  processing: { tone: "neutral", label: "Processing" },
  paid: { tone: "success", label: "Paid" },
  rejected: { tone: "danger", label: "Rejected" },
};

const money = (amount: number) => amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PlatformPayouts() {
  const [filter, setFilter] = useState<PayoutStatus | "">("");
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const page = usePaginatedQuery(api.payouts.listPlatformPayoutsPage, {}, { initialNumItems: 25 });
  const approve = useMutation(api.payouts.approvePayout);
  const markProcessing = useMutation(api.payouts.markPayoutProcessing);
  const markPaid = useMutation(api.payouts.markPayoutPaid);
  const reject = useMutation(api.payouts.rejectPayout);

  if (page.status === "LoadingFirstPage") return <Loading />;
  const rows = page.results.filter((row) => !filter || row.status === filter);
  const pending = page.results.filter((row) => row.status === "pending_approval").length;
  const inProgress = page.results.filter((row) => row.status === "processing").length;

  async function updateStatus(
    row: (typeof page.results)[number],
    action: "approved" | "processing" | "paid" | "rejected",
  ) {
    const prompt = action === "approved"
      ? "Approve this payout request?"
      : action === "processing"
      ? "Record that the approved payout has been submitted for payment?"
      : action === "paid"
        ? "Record this payout as paid after confirming settlement?"
        : "Reject this pending payout?";
    if (!window.confirm(prompt)) return;
    setWorkingId(row._id);
    setError("");
    try {
      if (action === "approved") await approve({ payoutId: row._id });
      else if (action === "processing") await markProcessing({ payoutId: row._id });
      else if (action === "paid") await markPaid({ payoutId: row._id });
      else await reject({ payoutId: row._id });
    } catch (cause) {
      setError(userFacingMessage(cause, "The payout status could not be updated."));
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform finance</p>
          <h1 className="page-title">Payouts</h1>
          <p className="page-subtitle">Review workspace payouts and record verified settlement steps.</p>
        </div>
        <Select value={filter} onChange={(event) => setFilter(event.target.value as PayoutStatus | "")} aria-label="Filter payouts by status">
          <option value="">All statuses</option>
          {Object.entries(statusInfo).map(([value, info]) => <option key={value} value={value}>{info.label}</option>)}
        </Select>
      </header>

      <section className="metric-grid" aria-label="Loaded payout summary">
        <article className="metric-card"><div className="metric-card-icon"><Clock3 size={18} /></div><span>Awaiting approval</span><strong>{pending}</strong><small>Loaded records</small></article>
        <article className="metric-card"><div className="metric-card-icon"><HandCoins size={18} /></div><span>Processing</span><strong>{inProgress}</strong><small>Loaded records</small></article>
        <article className="metric-card"><div className="metric-card-icon"><CheckCircle2 size={18} /></div><span>Records loaded</span><strong>{page.results.length}</strong><small>Across workspaces</small></article>
      </section>

      <section className="section-block">
        <div className="section-heading"><div><p className="eyebrow">Settlement queue</p><h2>Payout records</h2></div></div>
        <div className="pf-panel">
          {error && <p className="pf-error" role="alert">{error}</p>}
          {rows.length === 0 ? <EmptyState title="No payouts in this view" body="Payout requests will appear here when they are submitted." /> : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead><tr><th>Workspace</th><th>Payee class</th><th>Amount</th><th>Status</th><th>Approval tier</th><th>Requested</th><th>Actions</th></tr></thead>
                <tbody>{rows.map((row) => {
                  const info = statusInfo[row.status];
                  return <tr key={row._id}>
                    <td><strong>{row.workspaceName}</strong></td>
                    <td>{row.payeeType.replaceAll("_", " ")}</td>
                    <td>{money(row.amountLocal)} {row.currency}<small className="table-subtext">USD {money(row.amountUSD)}</small></td>
                    <td><StatusPill tone={info.tone}>{info.label}</StatusPill></td>
                    <td>{row.approvalTier.replaceAll("_", " ")}</td>
                    <td>{formatDateTime(row.requestedAt)}</td>
                    <td><div className="pf-action-row">
                      <Link className="secondary-button" href={`/platform/commissions/payouts/${row._id}`}>Details</Link>
                      {row.status === "pending_approval" && <button type="button" className="secondary-button" disabled={workingId === row._id} onClick={() => void updateStatus(row, "rejected")}>Reject</button>}
                      {row.status === "pending_approval" && row.approvalTier === "tier_1" && <button type="button" className="primary-button" disabled={workingId === row._id} onClick={() => void updateStatus(row, "approved")}>Approve</button>}
                      {row.status === "approved" && <button type="button" className="secondary-button" disabled={workingId === row._id} onClick={() => void updateStatus(row, "processing")}>Record sent</button>}
                      {row.status === "processing" && <button type="button" className="primary-button" disabled={workingId === row._id} onClick={() => void updateStatus(row, "paid")}>Confirm paid</button>}
                      {row.status === "pending_approval" && row.approvalTier !== "tier_1" && <small>Secure approval verification unavailable</small>}
                    </div></td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
          {page.status === "CanLoadMore" && <button type="button" className="secondary-button" onClick={() => page.loadMore(25)}>Load more payouts</button>}
          {page.status === "LoadingMore" && <p className="pf-hint">Loading more payouts…</p>}
        </div>
      </section>

      <p className="pf-hint">Approval codes are disabled until secure delivery is configured. Mark a payout as paid only after confirming settlement. These controls record status; they do not initiate transfers.</p>
    </main>
  );
}
