"use client";

import { useState } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Wallet, Clock, CheckCircle2, HandCoins } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, Loading, Select, StatusPill, formatDateTime } from "@/app/components/ui";

const statusInfo: Record<string, { tone: "success" | "warning" | "danger" | "neutral"; label: string }> = {
  pending_approval: { tone: "warning", label: "Pending approval" },
  approved: { tone: "neutral", label: "Approved" },
  processing: { tone: "neutral", label: "Processing" },
  paid: { tone: "success", label: "Paid" },
  rejected: { tone: "danger", label: "Rejected" },
};

type PayoutStatus = "pending_approval" | "approved" | "processing" | "paid" | "rejected";

const n = (v: number) => v.toLocaleString("en", { maximumFractionDigits: 2 });

export default function PayoutsPage() {
  const [status, setStatus] = useState<PayoutStatus | "">("");
  const summary = useQuery(api.payouts.payoutApprovalSummary, {});
  const payouts = useQuery(api.payouts.listPayouts, status ? { status } : { limit: 60 });
  const agents = useQuery(api.agents.listAgents, {});
  const investors = useQuery(api.investors.listInvestors, {});
  const users = useQuery(api.platformUsers.listUsers, {});

  if (summary === undefined || payouts === undefined || agents === undefined || investors === undefined || users === undefined) return <Loading />;

  const agentName = (id: string) => agents.find((a) => a._id === id)?.name ?? id;
  const investorName = (id: string) => investors.find((i) => i._id === id)?.name ?? id;
  const userName = (id: string) => users.find((u) => u._id === id)?.name ?? id.slice(0, 8);

  const payeeName = (type: string, id: string) => {
    if (type === "agent") return agentName(id);
    if (type === "investor") return investorName(id);
    if (type === "user") return userName(id);
    return id;
  };

  const pendingCount = summary.pendingTotal.length;
  const agentPending = summary.pendingAgent.length;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Finance</p>
          <h1 className="page-title">Payouts</h1>
          <p className="page-subtitle">Agent and investor settlements — approval queue, processing and payment history.</p>
        </div>
        <div style={{ minWidth: 220 }}>
          <Select value={status} onChange={(e) => setStatus(e.target.value as PayoutStatus | "")} aria-label="Filter by status">
            <option value="">All statuses</option>
            <option value="pending_approval">Pending approval</option>
            <option value="approved">Approved</option>
            <option value="processing">Processing</option>
            <option value="paid">Paid</option>
            <option value="rejected">Rejected</option>
          </Select>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Clock} label="Awaiting approval" value={pendingCount} tone={pendingCount > 0 ? "warning" : "success"} detail={`${agentPending} agent payouts`} />
        <MetricCard icon={CheckCircle2} label="Approvals needed" value={summary.approvalsNeeded} tone={summary.approvalsNeeded > 0 ? "danger" : "neutral"} detail="Above tier 1" />
        <MetricCard icon={HandCoins} label="Processed" value={payouts.filter((p) => p.status === "paid").length} tone="success" detail="In this view" />
        <MetricCard icon={Wallet} label="Currency" value="Mixed" tone="neutral" detail="Local + USD" />
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Ledger</p><h2>Payouts</h2></div>
        </div>
        <div className="pf-panel">
          {payouts.length === 0 ? (
            <EmptyState title="No payouts" body="Payout requests will appear once filed." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Payee</th>
                    <th className="pf-hide-sm">Type</th>
                    <th className="pf-hide-sm">Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th className="pf-hide-sm">Tier</th>
                    <th className="pf-hide-sm">Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.map((p) => {
                    const info = statusInfo[p.status] ?? { tone: "neutral" as const, label: p.status };
                    return (
                      <tr key={p._id}>
                        <td><strong>{payeeName(p.payeeType, p.payeeId)}</strong></td>
                        <td className="pf-hide-sm">{p.payeeType}</td>
                        <td className="pf-hide-sm">{p.method.replaceAll("_", " ")}</td>
                        <td>{n(p.amountLocal)} {p.currency}{p.currency !== "USD" ? ` · $${n(p.amountUSD)}` : ""}</td>
                        <td><StatusPill tone={info.tone}>{info.label}</StatusPill></td>
                        <td className="pf-hide-sm">{p.approvalTier.replace("_", " ")}</td>
                        <td className="pf-hide-sm">{formatDateTime(p.requestedAt)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
