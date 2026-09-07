"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { StatusPill, EmptyState, Loading, ErrorNote, formatMoney, formatDate } from "@/app/components/ui";

const STATUSES = [
  "accrued", "held", "requested", "approved", "processing", "paid", "disputed", "all",
] as const;
const STATUS_LABEL: Record<string, string> = {
  accrued: "Accrued", held: "Held (dispute window)",
  requested: "Requested", approved: "Approved", processing: "Processing",
  paid: "Paid", disputed: "Disputed", all: "All",
};
const METHODS = ["mpesa", "airtel_money", "bank_transfer"] as const;
type PayoutStatus = Exclude<(typeof STATUSES)[number], "all">;
type PayoutMethod = (typeof METHODS)[number];

const tone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  accrued: "neutral", held: "neutral", requested: "warning",
  approved: "warning", processing: "warning", paid: "success", disputed: "danger",
};

export default function CommissionsPage() {
  const [now] = useState(() => Date.now());
  const [status, setStatus] = useState<(typeof STATUSES)[number]>("requested");
  const commissions = useQuery(
    api.commissions.listCommissionsByStatus,
    status === "all" ? {} : { payoutStatus: status as PayoutStatus }
  );
  const agents = useQuery(api.agents.listAgents, {});
  const markets = useQuery(api.markets.listMarkets, {});

  const requestPayout = useMutation(api.commissions.requestCommissionPayout);
  const approve = useMutation(api.commissions.approveCommissionPayout);
  const markProcessing = useMutation(api.commissions.markCommissionProcessing);
  const markPaid = useMutation(api.commissions.markCommissionPaid);
  const dispute = useMutation(api.commissions.disputeCommission);

  const [payoutMethod, setPayoutMethod] = useState<Record<string, string>>({});
  const [disputeReason, setDisputeReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (commissions === undefined || agents === undefined || markets === undefined) return <Loading />;

  const agentName = (id: string) => agents.find((a) => a._id === id)?.name ?? `#${String(id).slice(-6)}`;
  const marketName = (id: string) => markets.find((m) => m._id === id)?.name ?? `#${String(id).slice(-6)}`;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    try {
      await fn();
      setMessage(ok);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed");
    }
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Commissions</h1>
          <p className="page-subtitle">The payout pipeline: held → requested → approved → processing → paid.</p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              className={status === s ? "primary-button" : "secondary-button"}
              onClick={() => setStatus(s)}
              style={{ minWidth: 92, textTransform: "capitalize" }}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </div>
      </div>

      <div className="pf-panel">
        <h2>{status === "all" ? "All commissions" : `${STATUS_LABEL[status]} (${commissions.length})`}</h2>
        {commissions.length === 0 ? (
          <EmptyState title="Nothing here" body="No commissions in this bucket." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="pf-hide-sm">Market</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th className="pf-hide-sm">Accrued</th>
                  <th>Dispute window</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {commissions.map((c) => (
                  <tr key={c._id}>
                    <td>
                      <strong>{agentName(c.agentId)}</strong>
                      {c.isFinalSettlement && <span className="pf-sub"> · final settlement</span>}
                    </td>
                    <td className="pf-hide-sm">{marketName(c.marketId)}</td>
                    <td>{formatMoney(c.amount, c.currency)}</td>
                    <td><StatusPill tone={tone[c.payoutStatus]}>{c.payoutStatus}</StatusPill></td>
                    <td className="pf-hide-sm">{formatDate(c.accruedAt)}</td>
                    <td className="pf-muted">{formatDate(c.disputeWindowEndsAt)}</td>
                    <td className="pf-actions">
                      {c.payoutStatus === "held" && now >= (c.disputeWindowEndsAt ?? 0) && (
                        <>
                          <select
                            className="pf-input"
                            style={{ width: 150 }}
                            value={payoutMethod[c._id] ?? ""}
                            onChange={(e) => setPayoutMethod((r) => ({ ...r, [c._id]: e.target.value }))}
                          >
                            <option value="" disabled>Withdraw via…</option>
                            {METHODS.map((m) => (<option key={m} value={m}>{m.replace("_", " ")}</option>))}
                          </select>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() => {
                              const method = payoutMethod[c._id];
                              if (!method) { setError("Pick a payout method."); return; }
                              run(() => requestPayout({ commissionId: c._id, payoutMethod: method as PayoutMethod }), "Payout requested.");
                            }}
                          >
                            Request payout
                          </button>
                        </>
                      )}
                      {c.payoutStatus === "requested" && (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => run(() => approve({ commissionId: c._id, requestedByUserId: undefined }), "Approved.")}
                        >
                          Approve
                        </button>
                      )}
                      {c.payoutStatus === "approved" && (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() => run(() => markProcessing({ commissionId: c._id }), "Marked processing.")}
                        >
                          Processing
                        </button>
                      )}
                      {c.payoutStatus === "processing" && (
                        <button
                          type="button"
                          className="primary-button"
                          onClick={() => run(() => markPaid({ commissionId: c._id }), "Marked paid.")}
                        >
                          Mark paid
                        </button>
                      )}
                      {c.payoutStatus !== "paid" && c.payoutStatus !== "disputed" && (
                        <>
                          <input
                            className="pf-input"
                            style={{ width: 140 }}
                            placeholder="Dispute reason (owner)"
                            value={disputeReason[c._id] ?? ""}
                            onChange={(e) => setDisputeReason((r) => ({ ...r, [c._id]: e.target.value }))}
                          />
                          <button
                            type="button"
                            className="danger-button"
                            onClick={() => {
                              const reason = disputeReason[c._id]?.trim();
                              if (!reason) { setError("Enter a reason to dispute."); return; }
                              run(() => dispute({ commissionId: c._id, reason }), "Disputed.");
                            }}
                          >
                            Dispute
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

