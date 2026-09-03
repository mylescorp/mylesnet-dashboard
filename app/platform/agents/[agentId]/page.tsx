"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Field, Select, TextInput, StatusPill, EmptyState, Loading, ErrorNote, formatMoney, formatDate } from "../../components/ui";

function statusTone(s: string) {
  switch (s) {
    case "accrued":
    case "held":
      return "neutral" as const;
    case "requested":
    case "approved":
    case "processing":
      return "warning" as const;
    case "paid":
      return "success" as const;
    case "disputed":
      return "danger" as const;
    default:
      return "neutral" as const;
  }
}

export default function AgentDetailPage() {
  const params = useParams<{ agentId: string }>();
  const router = useRouter();
  const agentId = params.agentId;
  const agent = useQuery(api.agents.getAgent, { agentId: agentId as any });
  const history = useQuery(api.agents.getAgentAssignmentHistory, { agentId: agentId as any });
  const commissions = useQuery(api.commissions.listCommissionsForAgent, { agentId: agentId as any });
  const markets = useQuery(api.markets.listMarkets);

  const assignAgent = useMutation(api.agents.assignAgentToMarket);
  const step1 = useMutation(api.agents.offboardAgentStep1CloseAssignments);
  const disposeVoucher = useMutation(api.agents.disposeOffboardingVoucher);
  const finalize = useMutation(api.agents.offboardAgentFinalize);
  const unsold = useQuery(
    api.agents.getAgentUnsoldVouchersForOffboarding,
    agent && agent.lifecycleStatus !== "terminated" ? { agentId: agentId as any } : "skip"
  );

  // Assignment form
  const [assignMarketId, setAssignMarketId] = useState("");
  const [assignCompType, setAssignCompType] = useState<"commission_only" | "salary_plus_commission">("commission_only");
  const [assignRate, setAssignRate] = useState("0.1");
  const [endPreviousId, setEndPreviousId] = useState("");

  // Reassign boxes
  const [reassignTarget, setReassignTarget] = useState<Record<string, string>>({});
  const [disposeError, setDisposeError] = useState<string | null>(null);

  // Finalize
  const [marketIdForSettlement, setMarketIdForSettlement] = useState("");
  const [finalAmount, setFinalAmount] = useState("");
  const [currency, setCurrency] = useState<"UGX" | "KSH">("UGX");

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [offboardStep, setOffboardStep] = useState(0);
  const [busy, setBusy] = useState(false);

  if (agent === undefined || history === undefined || commissions === undefined || markets === undefined) return <Loading />;
  if (!agent) return <EmptyState title="Agent not found" />;

  const activeAssignments = history.filter((h) => h.assignmentStatus === "active");

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!assignMarketId) {
      setError("Choose a market.");
      return;
    }
    try {
      await assignAgent({
        agentId: agent._id,
        marketId: assignMarketId as any,
        compensationType: assignCompType,
        commissionRate: Number(assignRate),
        endPreviousAssignmentId: endPreviousId ? (endPreviousId as any) : undefined,
        endReason: endPreviousId ? "reassigned" : undefined,
      });
      setMessage(activeAssignments.length > 0 && !endPreviousId ? "Multi-market assignment added." : "Assignment recorded.");
      setAssignMarketId("");
      setEndPreviousId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign agent");
    }
  };

  const handleStep1 = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await step1({ agentId: agent._id });
      setMessage(`Closed ${res.closedAssignments} active assignment(s).`);
      setOffboardStep(1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close assignments");
    } finally {
      setBusy(false);
    }
  };

  const handleDispose = async (voucherId: string, disposition: "reassign" | "returnToPool") => {
    setDisposeError(null);
    try {
      if (disposition === "reassign" && !reassignTarget[voucherId]) {
        setDisposeError("Choose a target agent before reassigning.");
        return;
      }
      await disposeVoucher({
        voucherId: voucherId as any,
        disposition,
        newOwnerAgentId: disposition === "reassign" ? (reassignTarget[voucherId] as any) : undefined,
      });
    } catch (err) {
      setDisposeError(err instanceof Error ? err.message : "Could not dispose voucher");
    }
  };

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!marketIdForSettlement) {
      setError("Choose a market for the final settlement.");
      return;
    }
    setBusy(true);
    try {
      await finalize({
        agentId: agent._id,
        finalSettlementAmount: Number(finalAmount),
        currency,
        marketId: marketIdForSettlement as any,
      });
      setMessage("Agent offboarded. Final settlement entered the commission approval flow.");
      setTimeout(() => router.replace("/platform/agents"), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finalize offboarding");
    } finally {
      setBusy(false);
    }
  };

  const owed = commissions.filter((c) => c.payoutStatus !== "paid").reduce((s, c) => s + c.amount, 0);
  const currencyForOwed = agent ? commissions.find((c) => c.currency)?.currency ?? "UGX" : "UGX";

  return (
    <div className="workspace-page">
      <p className="pf-badge"><Link href="/platform/agents">← All agents</Link></p>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Agent</p>
          <h1 className="page-title">{agent.name}</h1>
          <p className="page-subtitle">{agent.phone}{agent.email ? ` · ${agent.email}` : ""}</p>
        </div>
        <StatusPill tone={agent.lifecycleStatus === "active" ? "success" : agent.lifecycleStatus === "suspended" ? "warning" : "danger"}>
          {agent.lifecycleStatus}
        </StatusPill>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <div className="pf-stack">
        <div className="pf-panel">
          <h2>Commission balance</h2>
          <p className="pf-muted">Unpaid (not yet marked “paid”) across all statuses except paid.</p>
          <p style={{ fontSize: 26, fontWeight: 800, margin: 0 }}>
            {formatMoney(owed, currencyForOwed)}
          </p>
        </div>

        <div className="pf-panel">
          <h2>Assign to market</h2>
          <form onSubmit={handleAssign} className="pf-form-grid" style={{ marginTop: 12 }}>
            <Field label="Market">
              <Select value={assignMarketId} onChange={(e) => setAssignMarketId(e.target.value)} required>
                <option value="" disabled>Select market…</option>
                {markets.map((m) => (
                  <option key={m._id} value={m._id as string}>{m.name}</option>
                ))}
              </Select>
            </Field>
            <Field label="Close previous assignment (choose to reassign)">
              <Select value={endPreviousId} onChange={(e) => setEndPreviousId(e.target.value)}>
                <option value="">Keep all active (multi-market)</option>
                {activeAssignments.map((a) => (
                  <option key={a._id} value={a._id as string}>Close assignment #{String(a._id).slice(-6)}</option>
                ))}
              </Select>
            </Field>
            <Field label="Compensation">
              <Select value={assignCompType} onChange={(e) => setAssignCompType(e.target.value as typeof assignCompType)}>
                <option value="commission_only">Commission only</option>
                <option value="salary_plus_commission">Salary + commission</option>
              </Select>
            </Field>
            <Field label="Commission rate">
              <TextInput type="number" step="0.01" min="0" value={assignRate} onChange={(e) => setAssignRate(e.target.value)} />
            </Field>
          </form>
          <div className="pf-form-actions">
            <button type="button" className="primary-button" onClick={handleAssign}>Assign</button>
          </div>
        </div>

        <div className="pf-panel">
          <h2>Assignment history</h2>
          {history.length === 0 ? (
            <EmptyState title="No assignments yet" />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Market</th>
                    <th>Status</th>
                    <th className="pf-hide-sm">Compensation</th>
                    <th>Rate</th>
                    <th>Started</th>
                    <th className="pf-hide-sm">Ended</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr key={h._id}>
                      <td>#{String(h.marketId).slice(-6)}</td>
                      <td><StatusPill tone={h.assignmentStatus === "active" ? "success" : "neutral"}>{h.assignmentStatus}</StatusPill></td>
                      <td className="pf-hide-sm">{h.compensationType.replace("_", " ")}</td>
                      <td>{(h.commissionRate * 100).toFixed(0)}%</td>
                      <td>{formatDate(h.startedAt)}</td>
                      <td className="pf-hide-sm">{formatDate(h.endedAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {agent.lifecycleStatus !== "terminated" && (
          <div className="pf-panel" style={{ borderColor: "color-mix(in srgb, var(--danger) 30%, var(--line))" }}>
            <h2 style={{ color: "var(--danger)" }}>Offboarding wizard</h2>
            <p className="pf-muted">
              Step 1 closes assignments · Step 2 disposes unsold vouchers · Step 3 routes final settlement through
              the standard commission approval flow and marks the agent terminated.
            </p>

            {offboardStep === 0 && (
              <div className="pf-form-actions">
                <button type="button" className="danger-button" onClick={handleStep1} disabled={busy}>
                  {busy ? "Closing…" : `Step 1 · Close ${activeAssignments.length} active assignment(s)`}
                </button>
              </div>
            )}

            {offboardStep >= 1 && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ marginTop: 0 }}>Step 2 · Dispose unsold vouchers</h3>
                {disposeError && <ErrorNote>{disposeError}</ErrorNote>}
                {unsold === undefined ? (
                  <Loading />
                ) : unsold.length === 0 ? (
                  <p className="pf-muted">No unsold vouchers owned by this agent.</p>
                ) : (
                  <div className="pf-table-wrap">
                    <table className="pf-table">
                      <thead>
                        <tr>
                          <th>Code</th>
                          <th>Status</th>
                          <th>Market</th>
                          <th>Reassign to</th>
                          <th></th>
                        </tr>
                      </thead>
                      <tbody>
                        {unsold.map((v) => (
                          <tr key={v._id}>
                            <td><strong>{v.code}</strong></td>
                            <td><StatusPill tone={v.voucherStatus === "owned" ? "neutral" : "neutral"}>{v.voucherStatus}</StatusPill></td>
                            <td className="pf-muted">#{String(v.marketId).slice(-6)}</td>
                            <td>
                              <TextInput placeholder="Target agent id" value={reassignTarget[v._id] ?? ""} onChange={(e) => setReassignTarget((r) => ({ ...r, [v._id]: e.target.value }))} style={{ width: 160 }} />
                            </td>
                            <td className="pf-actions">
                              <button type="button" className="secondary-button" onClick={() => handleDispose(v._id, "reassign")}>Reassign</button>
                              <button type="button" className="secondary-button" onClick={() => handleDispose(v._id, "returnToPool")}>Return to pool</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {offboardStep >= 1 && (
              <form onSubmit={handleFinalize} style={{ marginTop: 20 }}>
                <h3>Step 3 · Final settlement</h3>
                <p className="pf-muted">
                  The amount entered here becomes a commission in <strong>held</strong> status and flows through the
                  normal dispute + approval pipeline before payout.
                </p>
                <div className="pf-form-grid">
                  <Field label="Market">
                    <Select value={marketIdForSettlement} onChange={(e) => setMarketIdForSettlement(e.target.value)} required>
                      <option value="" disabled>Select market…</option>
                      {markets.map((m) => (
                        <option key={m._id} value={m._id as string}>{m.name}</option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="Final settlement amount">
                    <TextInput type="number" step="0.01" min="0" value={finalAmount} onChange={(e) => setFinalAmount(e.target.value)} required />
                  </Field>
                  <Field label="Currency">
                    <Select value={currency} onChange={(e) => setCurrency(e.target.value as "UGX" | "KSH")}>
                      <option value="UGX">UGX</option>
                      <option value="KSH">KSH</option>
                    </Select>
                  </Field>
                </div>
                <div className="pf-form-actions">
                  <button type="submit" className="danger-button" disabled={busy}>
                    {busy ? "Finalizing…" : "Finalize offboarding"}
                  </button>
                </div>
              </form>
            )}

            {offboardStep === 0 && agent.lifecycleStatus === "suspended" && (
              <p className="pf-hint" style={{ marginTop: 10 }}>Tip: suspended agents keep their assignment rows until you run Step 1.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
