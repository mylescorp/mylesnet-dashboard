"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus, RefreshCw } from "lucide-react";
import { Field, Select, TextInput, StatusPill, EmptyState, Loading, ErrorNote } from "../components/ui";

const LIFECYCLE = ["planned", "active", "paused", "decommissioned"] as const;
type Lifecycle = (typeof LIFECYCLE)[number];

const lifecycleTone = (s: Lifecycle) =>
  s === "active" ? "success" : s === "paused" ? "warning" : s === "decommissioned" ? "danger" : "neutral";

const PLAN_LABEL: Record<string, string> = {
  half_day: "Half-day",
  day: "Day",
  week: "Week",
  month: "Month",
  specialty: "Specialty",
};

export default function MarketsPage() {
  const markets = useQuery(api.markets.listMarkets);
  const currentYearMonth = new Date().toISOString().slice(0, 7);
  const missing = useQuery(api.markets.listMarketsMissingCostEntry, { yearMonth: currentYearMonth });
  const createMarket = useMutation(api.markets.createMarket);
  const updateStatus = useMutation(api.markets.updateMarketLifecycleStatus);
  const [refreshTick, setRefreshTick] = useState(0);

  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState<"UGX" | "KSH">("UGX");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const missingIds = new Set((missing ?? []).map((m) => m._id));

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setCreating(true);
    try {
      await createMarket({ name, country, currency });
      setMessage(`Market "${name}" created.`);
      setName("");
      setCountry("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create market");
    } finally {
      setCreating(false);
    }
  };

  const handleStatus = async (marketId: string, lifecycleStatus: Lifecycle) => {
    setError(null);
    try {
      await updateStatus({ marketId: marketId as any, lifecycleStatus });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update status");
    }
  };

  if (markets === undefined) return <Loading />;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Markets</h1>
          <p className="page-subtitle">Service areas, lifecycle status and monthly operating costs.</p>
        </div>
        <div className="page-action-group">
          <button type="button" className="secondary-button" onClick={() => setRefreshTick((t) => t + 1)}>
            <RefreshCw aria-hidden="true" size={15} /> Refresh
          </button>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <form className="pf-panel" style={{ marginBottom: 22 }} onSubmit={handleCreate}>
        <h2>Add a market</h2>
        <p className="pf-muted">Register a new service area. Markets start as “planned”.</p>
        <div className="pf-form-grid">
          <Field label="Market name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Tayari" required />
          </Field>
          <Field label="Country">
            <TextInput value={country} onChange={(e) => setCountry(e.target.value)} placeholder="e.g. Uganda" required />
          </Field>
          <Field label="Currency">
            <Select value={currency} onChange={(e) => setCurrency(e.target.value as "UGX" | "KSH")}>
              <option value="UGX">UGX — Uganda Shillings</option>
              <option value="KSH">KSH — Kenya Shillings</option>
            </Select>
          </Field>
        </div>
        <div className="pf-form-actions">
          <button type="submit" className="primary-button" disabled={creating}>
            <Plus aria-hidden="true" size={16} /> {creating ? "Creating…" : "Create market"}
          </button>
        </div>
      </form>

      <div className="pf-panel">
        <h2>All markets</h2>
        <p className="pf-muted">
          {markets.length} market(s). A warning badge means no operating cost has been reported for the current month.
        </p>
        {markets.length === 0 ? (
          <EmptyState title="No markets yet" body="Create your first market above." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Market</th>
                  <th>Country</th>
                  <th>Currency</th>
                  <th>Lifecycle</th>
                  <th>Cost reported</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {markets.map((m) => (
                  <tr key={m._id}>
                    <td>
                      <strong>{m.name}</strong>
                    </td>
                    <td>{m.country}</td>
                    <td>{m.currency}</td>
                    <td>
                      <StatusPill tone={lifecycleTone(m.lifecycleStatus)}>{m.lifecycleStatus}</StatusPill>
                    </td>
                    <td>
                      {missingIds.has(m._id) ? (
                        <StatusPill tone="danger">⚠ Missing cost entry</StatusPill>
                      ) : (
                        <span className="pf-muted">Reported</span>
                      )}
                    </td>
                    <td className="pf-actions">
                      <Link href={`/platform/markets/${m._id}`} className="secondary-button">
                        Open
                      </Link>
                      <Select
                        value={m.lifecycleStatus}
                        onChange={(e) => handleStatus(m._id, e.target.value as Lifecycle)}
                      >
                        {LIFECYCLE.map((s) => (
                          <option key={s} value={s} disabled={s === m.lifecycleStatus}>
                            {s}
                          </option>
                        ))}
                      </Select>
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
