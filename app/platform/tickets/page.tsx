"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Field, Select, TextInput, TextArea, StatusPill, EmptyState, Loading, ErrorNote, formatDateTime } from "../components/ui";

const statusTone: Record<string, "neutral" | "warning" | "success" | "danger"> = {
  open: "danger",
  in_progress: "warning",
  waiting_on_customer: "neutral",
  resolved: "success",
  closed: "neutral",
};

const priorityTone: Record<string, "neutral" | "warning" | "danger"> = {
  low: "neutral",
  medium: "warning",
  high: "danger",
  urgent: "danger",
};

export default function TicketsPage() {
  const tickets = useQuery(api.supportTickets.listSupportTickets, {});
  const markets = useQuery(api.markets.listMarkets);
  const agents = useQuery(api.agents.listAgents);
  const create = useMutation(api.supportTickets.createSupportTicket);
  const update = useMutation(api.supportTickets.updateSupportTicket);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("open");
  const [showForm, setShowForm] = useState(false);

  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high" | "urgent">("medium");
  const [marketId, setMarketId] = useState("");
  const [agentId, setAgentId] = useState("");

  if (tickets === undefined || markets === undefined || agents === undefined) return <Loading />;

  const visible = filter === "all" ? tickets : tickets.filter((t) => t.ticketStatus === filter);

  const marketName = (id: string) => markets.find((m) => m._id === id)?.name ?? `#${String(id).slice(-6)}`;
  const agentName = (id: string) => agents.find((a) => a._id === id)?.name ?? `#${String(id).slice(-6)}`;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!subject.trim() || !description.trim()) {
      setError("Subject and description are required.");
      return;
    }
    try {
      await create({
        subject,
        description,
        priority,
        marketId: marketId ? (marketId as any) : undefined,
        agentId: agentId ? (agentId as any) : undefined,
      });
      setMessage("Ticket created.");
      setShowForm(false);
      setSubject(""); setDescription(""); setMarketId(""); setAgentId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create ticket");
    }
  };

  const handleStatusChange = async (ticketId: string, newStatus: string) => {
    try {
      await update({ ticketId: ticketId as any, ticketStatus: newStatus as any });
      setMessage(`Ticket updated to ${newStatus}.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update ticket");
    }
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Support Tickets</h1>
          <p className="page-subtitle">Queue for market and agent support issues.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Ticket"}
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      {showForm && (
        <div className="pf-panel">
          <h2>New Ticket</h2>
          <form onSubmit={handleCreate} className="pf-form-grid" style={{ marginTop: 12 }}>
            <Field label="Subject"><TextInput value={subject} onChange={(e) => setSubject(e.target.value)} required /></Field>
            <Field label="Description"><TextArea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} required /></Field>
            <Field label="Priority">
              <Select value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </Select>
            </Field>
            <Field label="Market (optional)">
              <Select value={marketId} onChange={(e) => setMarketId(e.target.value)}>
                <option value="">None</option>
                {markets.map((m) => <option key={m._id} value={m._id as string}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Agent (optional)">
              <Select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
                <option value="">None</option>
                {agents.map((a) => <option key={a._id} value={a._id as string}>{a.name}</option>)}
              </Select>
            </Field>
          </form>
          <div className="pf-form-actions">
            <button type="button" className="primary-button" onClick={handleCreate}>Create Ticket</button>
          </div>
        </div>
      )}

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          {["open", "in_progress", "waiting_on_customer", "resolved", "closed", "all"].map((s) => (
            <button key={s} type="button" className={filter === s ? "primary-button" : "secondary-button"} onClick={() => setFilter(s)}>
              {s === "all" ? `All (${tickets.length})` : s.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>

      <div className="pf-panel">
        {visible.length === 0 ? (
          <EmptyState title="No tickets" body="All clear." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Market</th>
                  <th className="pf-hide-sm">Agent</th>
                  <th>Status</th>
                  <th className="pf-hide-sm">Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((t) => (
                  <tr key={t._id}>
                    <td><strong>{t.subject}</strong></td>
                    <td><StatusPill tone={priorityTone[t.priority]}>{t.priority}</StatusPill></td>
                    <td>{t.marketId ? marketName(t.marketId) : "—"}</td>
                    <td className="pf-hide-sm">{t.agentId ? agentName(t.agentId) : "—"}</td>
                    <td><StatusPill tone={statusTone[t.ticketStatus]}>{t.ticketStatus.replace(/_/g, " ")}</StatusPill></td>
                    <td className="pf-hide-sm">{formatDateTime(t.createdAt)}</td>
                    <td className="pf-actions">
                      {t.ticketStatus === "open" && (
                        <button type="button" className="secondary-button" onClick={() => handleStatusChange(t._id, "in_progress")}>Start</button>
                      )}
                      {t.ticketStatus === "in_progress" && (
                        <button type="button" className="primary-button" onClick={() => handleStatusChange(t._id, "resolved")}>Resolve</button>
                      )}
                      {t.ticketStatus === "resolved" && (
                        <button type="button" className="secondary-button" onClick={() => handleStatusChange(t._id, "closed")}>Close</button>
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
