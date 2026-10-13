"use client";

import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useQuery } from "@/shared/lib/convex";
import { EmptyState, Loading, StatusPill, formatDateTime } from "@/shared/components/ui";

const statusTone = {
  pending_approval: "warning",
  approved: "neutral",
  processing: "neutral",
  paid: "success",
  rejected: "danger",
} as const;

const money = (amount: number) => amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function PlatformPayoutDetail({ payoutId }: { payoutId: string }) {
  const payout = useQuery(api.payouts.getPlatformPayout, { payoutId: payoutId as Id<"payouts"> });
  if (payout === undefined) return <Loading />;
  if (payout === null) return <main className="workspace-page"><EmptyState title="Payout unavailable" body="The payout may have been removed or you may not have access to it." /></main>;

  return (
    <main className="workspace-page">
      <p className="eyebrow"><Link href="/platform/commissions/payouts">Payouts</Link></p>
      <div className="page-heading"><div><p className="eyebrow">{payout.workspaceName}</p><h1 className="page-title">Payout details</h1><p className="page-subtitle">Review the request and its recorded settlement state.</p></div><StatusPill tone={statusTone[payout.status]}>{payout.status.replaceAll("_", " ")}</StatusPill></div>
      <section className="pf-panel">
        <dl className="pf-detail-grid">
          <div><dt>Payee class</dt><dd>{payout.payeeType.replaceAll("_", " ")}</dd></div>
          <div><dt>Requested amount</dt><dd>{money(payout.amountLocal)} {payout.currency}</dd></div>
          <div><dt>Reference amount</dt><dd>USD {money(payout.amountUSD)}</dd></div>
          <div><dt>Approval tier</dt><dd>{payout.approvalTier.replaceAll("_", " ")}</dd></div>
          <div><dt>Payment method</dt><dd>{payout.method.replaceAll("_", " ")}</dd></div>
          <div><dt>Requested</dt><dd>{formatDateTime(payout.requestedAt)}</dd></div>
          <div><dt>Approved</dt><dd>{payout.approvedAt ? formatDateTime(payout.approvedAt) : "Not approved"}</dd></div>
          <div><dt>Paid</dt><dd>{payout.processedAt ? formatDateTime(payout.processedAt) : "Not recorded"}</dd></div>
        </dl>
        <p className="pf-hint">Account identifiers and verification secrets are not shown. This page records payout state; it does not initiate transfers.</p>
      </section>
    </main>
  );
}
