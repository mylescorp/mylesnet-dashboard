"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Trash2 } from "lucide-react";
import { Field, Select, TextInput, StatusPill, EmptyState, Loading, ErrorNote, formatMoney } from "@/app/components/ui";

const LIFECYCLE = ["planned", "active", "paused", "decommissioned"] as const;
type Lifecycle = (typeof LIFECYCLE)[number];

export default function MarketDetailPage() {
  const params = useParams<{ marketId: string }>();
  const marketId = params.marketId;
  const market = useQuery(api.markets.getMarket, { marketId: marketId as Id<"markets"> });
  const costs = useQuery(api.markets.listOperatingCosts, { marketId: marketId as Id<"markets"> });
  const staffing = useQuery(api.markets.getMarketStaffingStatus, { marketId: marketId as Id<"markets"> });
  const reportCost = useMutation(api.markets.reportOperatingCost);
  const updateStatus = useMutation(api.markets.updateMarketLifecycleStatus);
  const softDelete = useMutation(api.markets.softDeleteMarket);

  const cur = market?.currency ?? "UGX";
  const [yearMonth, setYearMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [airtelDataCost, setAirtelDataCost] = useState("");
  const [electricityCost, setElectricityCost] = useState("");
  const [deleteReason, setDeleteReason] = useState("");
  const [forceCascade, setForceCascade] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (market === undefined || costs === undefined || staffing === undefined) return <Loading />;
  if (!market) return <EmptyState title="Market not found" />;

  const handleReport = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await reportCost({
        marketId: market._id,
        yearMonth,
        airtelDataCost: Number(airtelDataCost),
        electricityCost: Number(electricityCost),
        currency: cur,
      });
      setMessage(`Operating cost for ${yearMonth} saved.`);
      setAirtelDataCost("");
      setElectricityCost("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save cost");
    } finally {
      setBusy(false);
    }
  };

  const handleStatus = async (lifecycleStatus: Lifecycle) => {
    setError(null);
    try {
      await updateStatus({ marketId: market._id, lifecycleStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  };

  const handleDelete = async () => {
    setError(null);
    if (!deleteReason.trim()) {
      setError("A delete reason is required.");
      return;
    }
    setBusy(true);
    try {
      await softDelete({ marketId: market._id, deleteReason: deleteReason.trim(), forceCascade });
      setMessage(forceCascade ? "Market and its dependents soft-deleted." : "Market soft-deleted.");
      setDeleteReason("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete market");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="workspace-page">
      <p className="pf-badge">
        <Link href="/markets">← All markets</Link>
      </p>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Market</p>
          <h1 className="page-title">{market.name}</h1>
          <p className="page-subtitle">
            {market.country} · {market.currency} · added {new Date(market.createdAt).toLocaleDateString()}
          </p>
        </div>
        <div className="page-action-group">
          <StatusPill tone={market.lifecycleStatus === "active" ? "success" : market.lifecycleStatus === "paused" ? "warning" : "neutral"}>
            {market.lifecycleStatus}
          </StatusPill>
          <Select value={market.lifecycleStatus} onChange={(e) => handleStatus(e.target.value as Lifecycle)}>
            {LIFECYCLE.map((s) => (
              <option key={s} value={s} disabled={s === market.lifecycleStatus}>
                {s}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <div className="pf-stack">
        {staffing.isUnstaffed && market.lifecycleStatus === "active" && (
          <div className="pf-panel platform-action-card-platform-warning" style={{ borderColor: "color-mix(in srgb, var(--warning) 40%, var(--line))" }}>
            <h2 style={{ marginTop: 0 }}>Unstaffed market — action required</h2>
            <p className="pf-muted">
              This active market has <strong>no active agent assignment</strong>. Sales and voucher allocation cannot
              be attributed until an agent is assigned.
            </p>
            <Link href={`/agents?market=${marketId}`} className="primary-button" style={{ textDecoration: "none", display: "inline-block", marginTop: 8 }}>
              Assign an agent
            </Link>
          </div>
        )}

        {!staffing.isUnstaffed && (
          <div className="pf-panel">
            <h2>Assigned agents</h2>
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Agent</th>
                    <th>Compensation</th>
                    <th>Rate</th>
                    <th className="pf-hide-sm">Since</th>
                  </tr>
                </thead>
                <tbody>
                  {staffing.agents.map((a) => (
                    <tr key={a.agentId}>
                      <td><Link href={`/agents/${a.agentId}`}>{a.agentName}</Link></td>
                      <td>{a.compensationType.replace(/_/g, " ")}</td>
                      <td>{(a.commissionRate * 100).toFixed(0)}%</td>
                      <td className="pf-hide-sm">{new Date(a.startedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <form className="pf-panel" onSubmit={handleReport}>
          <h2>Report monthly operating cost</h2>
          <p className="pf-muted">
            Airtel data + electricity for one month. Missing months stay flagged as a gap — they are never assumed.
          </p>
          <div className="pf-form-grid">
            <Field label="Month">
              <TextInput type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} required />
            </Field>
            <Field label={`Airtel data cost (${cur})`}>
              <TextInput type="number" min="0" step="0.01" value={airtelDataCost} onChange={(e) => setAirtelDataCost(e.target.value)} required />
            </Field>
            <Field label={`Electricity cost (${cur})`}>
              <TextInput type="number" min="0" step="0.01" value={electricityCost} onChange={(e) => setElectricityCost(e.target.value)} required />
            </Field>
          </div>
          <div className="pf-form-actions">
            <button type="submit" className="primary-button" disabled={busy}>Save cost entry</button>
          </div>
        </form>

        <div className="pf-panel">
          <h2>Operating cost history</h2>
          {costs.length === 0 ? (
            <EmptyState title="No cost entries yet" body="Report this market’s first month of operating costs." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Airtel data</th>
                    <th>Electricity</th>
                    <th>Total</th>
                    <th>Reported</th>
                  </tr>
                </thead>
                <tbody>
                  {costs.map((c) => (
                    <tr key={c._id}>
                      <td><strong>{c.yearMonth}</strong></td>
                      <td>{formatMoney(c.airtelDataCost, c.currency)}</td>
                      <td>{formatMoney(c.electricityCost, c.currency)}</td>
                      <td>{formatMoney(c.airtelDataCost + c.electricityCost, c.currency)}</td>
                      <td className="pf-muted">{new Date(c.reportedAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="pf-panel" style={{ borderColor: "color-mix(in srgb, var(--danger) 30%, var(--line))" }}>
          <h2 style={{ color: "var(--danger)" }}>Soft-delete market</h2>
          <p className="pf-muted">
            Soft delete hides the market everywhere it is queried. Active devices or agent assignments block deletion
            unless you choose to delete the dependents together.
          </p>
          <div className="pf-form-grid">
            <Field label="Delete reason">
              <TextInput value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="e.g. Market decommissioned" />
            </Field>
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 12, fontSize: 13 }}>
            <input type="checkbox" checked={forceCascade} onChange={(e) => setForceCascade(e.target.checked)} />
            Soft-delete dependent devices and close active agent assignments together (cascade)
          </label>
          <div className="pf-form-actions">
            <button type="button" className="danger-button" onClick={handleDelete} disabled={busy}>
              <Trash2 aria-hidden="true" size={15} /> Delete market
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

