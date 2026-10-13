"use client";

import { usePaginatedQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { EmptyState, Loading, StatusPill, formatDateTime } from "@/shared/components/ui";

const tone = (status: string): "success" | "warning" | "danger" | "neutral" => {
  if (status === "paid") return "success";
  if (status === "held" || status === "requested") return "warning";
  if (status === "disputed") return "danger";
  return "neutral";
};

export function PlatformCommissionLedger() {
  const page = usePaginatedQuery(api.commissions.listPlatformCommissionsPage, {}, { initialNumItems: 25 });
  if (page.status === "LoadingFirstPage") return <Loading />;

  return (
    <main className="workspace-page">
      <header className="page-heading">
        <div><p className="eyebrow">Platform finance</p><h1 className="page-title">Commission ledger</h1><p className="page-subtitle">Accrued agent commissions across workspaces, with payout and dispute-window status.</p></div>
      </header>
      <section className="pf-panel">
        <p className="pf-hint">This ledger is append-only for financial history. Disputes and payout transitions are recorded as audited state changes.</p>
        {page.results.length === 0 ? <EmptyState title="No commission records" body="Commission entries will appear when an eligible sale is recorded." /> : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead><tr><th>Agent</th><th>Market</th><th>Amount</th><th>Status</th><th>Dispute window ends</th><th>Accrued</th></tr></thead>
              <tbody>{page.results.map((commission) => <tr key={commission._id}>
                <td><strong>{commission.agentName}</strong>{commission.isFinalSettlement && <small className="table-subtext">Final settlement</small>}</td>
                <td>{commission.marketName}</td>
                <td>{commission.amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} {commission.currency}</td>
                <td><StatusPill tone={tone(commission.payoutStatus)}>{commission.payoutStatus.replaceAll("_", " ")}</StatusPill></td>
                <td>{formatDateTime(commission.disputeWindowEndsAt)}</td>
                <td>{formatDateTime(commission.accruedAt)}</td>
              </tr>)}</tbody>
            </table>
          </div>
        )}
        {page.status === "CanLoadMore" && <button type="button" className="secondary-button" onClick={() => page.loadMore(25)}>Load more commissions</button>}
        {page.status === "LoadingMore" && <p className="pf-hint">Loading more commission entries…</p>}
      </section>
    </main>
  );
}
