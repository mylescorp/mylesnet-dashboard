"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus } from "lucide-react";
import { Field, Select, TextInput, StatusPill, EmptyState, Loading, ErrorNote } from "../components/ui";

const lifecycleTone = (s: string) =>
  s === "active" ? "success" : s === "suspended" ? "warning" : "danger";

export default function AgentsPage() {
  const agents = useQuery(api.agents.listAgents, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const createAgent = useMutation(api.agents.createAgent);
  const suspendAgent = useMutation(api.agents.suspendAgent);
  const reactivateAgent = useMutation(api.agents.reactivateAgent);
  const assignAgent = useMutation(api.agents.assignAgentToMarket);

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [suspendReason, setSuspendReason] = useState<Record<string, string>>({});
  const [assignAgentId, setAssignAgentId] = useState("");
  const [assignMarketId, setAssignMarketId] = useState("");
  const [assignCompType, setAssignCompType] = useState<"commission_only" | "salary_plus_commission">("commission_only");
  const [assignRate, setAssignRate] = useState("0.1");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await createAgent({ name, phone, email: email || undefined });
      setMessage(`Agent "${name}" created.`);
      setName("");
      setPhone("");
      setEmail("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create agent");
    }
  };

  const handleSuspend = async (agentId: string, agentName: string) => {
    setError(null);
    const reason = suspendReason[agentId]?.trim();
    if (!reason) {
      setError(`Provide a reason to suspend "${agentName}".`);
      return;
    }
    try {
      await suspendAgent({ agentId: agentId as any, reason });
      setMessage(`Agent "${agentName}" suspended.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not suspend agent");
    }
  };

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!assignAgentId || !assignMarketId) {
      setError("Choose an agent and a market.");
      return;
    }
    try {
      await assignAgent({ agentId: assignAgentId as any, marketId: assignMarketId as any, compensationType: assignCompType, commissionRate: Number(assignRate) });
      setMessage("Agent assigned to market.");
      setAssignAgentId("");
      setAssignMarketId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not assign agent");
    }
  };

  if (agents === undefined || markets === undefined) return <Loading />;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Agents</h1>
          <p className="page-subtitle">Voucher sales staff, market assignments and offboarding.</p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <form className="pf-panel" style={{ marginBottom: 22 }} onSubmit={handleCreate}>
        <h2>Add an agent</h2>
        <p className="pf-muted">Minimal PII on purpose — attribution only, per build rules.</p>
        <div className="pf-form-grid">
          <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Jane W." /></Field>
          <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} required placeholder="e.g. +2567…" /></Field>
          <Field label="Email (optional)"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        </div>
        <div className="pf-form-actions">
          <button type="submit" className="primary-button"><Plus aria-hidden="true" size={16} /> Create agent</button>
        </div>
      </form>

      <form className="pf-panel" style={{ marginBottom: 22 }} onSubmit={handleAssign}>
        <h2>Assign to a market</h2>
        <p className="pf-muted">Closing an agent’s previous market happens on the agent page (close-and-open).</p>
        <div className="pf-form-grid">
          <Field label="Agent">
            <Select value={assignAgentId} onChange={(e) => setAssignAgentId(e.target.value)} required>
              <option value="" disabled>Select agent…</option>
              {agents.map((a) => (
                <option key={a._id} value={a._id as string}>{a.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Market">
            <Select value={assignMarketId} onChange={(e) => setAssignMarketId(e.target.value)} required>
              <option value="" disabled>Select market…</option>
              {markets.map((m) => (
                <option key={m._id} value={m._id as string}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Compensation">
            <Select value={assignCompType} onChange={(e) => setAssignCompType(e.target.value as typeof assignCompType)}>
              <option value="commission_only">Commission only</option>
              <option value="salary_plus_commission">Salary + commission</option>
            </Select>
          </Field>
          <Field label="Commission rate (e.g. 0.1 = 10%)">
            <TextInput type="number" step="0.01" min="0" value={assignRate} onChange={(e) => setAssignRate(e.target.value)} required />
          </Field>
        </div>
        <div className="pf-form-actions">
          <button type="submit" className="primary-button">Assign agent</button>
        </div>
      </form>

      <div className="pf-panel">
        <h2>All agents ({agents.length})</h2>
        {agents.length === 0 ? (
          <EmptyState title="No agents yet" body="Create an agent above." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th className="pf-hide-sm">Phone</th>
                  <th>Lifecycle</th>
                  <th>Suspended reason</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a._id}>
                    <td><strong>{a.name}</strong></td>
                    <td className="pf-hide-sm">{a.phone}</td>
                    <td><StatusPill tone={lifecycleTone(a.lifecycleStatus)}>{a.lifecycleStatus}</StatusPill></td>
                    <td>
                      {a.lifecycleStatus === "suspended" ? (
                        <TextInput placeholder="Reason to suspend" value={suspendReason[a._id] ?? ""} onChange={(e) => setSuspendReason((r) => ({ ...r, [a._id]: e.target.value }))} style={{ width: 170 }} />
                      ) : (
                        <span className="pf-muted">—</span>
                      )}
                    </td>
                    <td className="pf-actions">
                      <Link href={`/platform/agents/${a._id}`} className="secondary-button">Open</Link>
                      {a.lifecycleStatus === "suspended" ? (
                        <button type="button" className="secondary-button" onClick={() => reactivateAgent({ agentId: a._id })}>Reactivate</button>
                      ) : (
                        <button type="button" className="danger-button" onClick={() => handleSuspend(a._id, a.name)}>Suspend</button>
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
