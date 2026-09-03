"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Field, Select, TextInput, TextArea, StatusPill, EmptyState, Loading, ErrorNote, formatDateTime } from "../components/ui";

export default function CommsPage() {
  const broadcasts = useQuery(api.broadcasts.listBroadcasts, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const agents = useQuery(api.agents.listAgents, {});
  const createBroadcast = useMutation(api.broadcasts.createBroadcast);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [scope, setScope] = useState<"all_agents" | "market_agents" | "specific_agents">("all_agents");
  const [targetMarket, setTargetMarket] = useState("");
  const [targetAgents, setTargetAgents] = useState<string[]>([]);
  const [expandedBroadcast, setExpandedBroadcast] = useState<string | null>(null);

  const deliveryLogs = useQuery(
    api.broadcasts.getBroadcastDeliveryLogs,
    expandedBroadcast ? { broadcastId: expandedBroadcast as any } : "skip"
  );

  if (broadcasts === undefined || markets === undefined || agents === undefined) return <Loading />;

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!messageText.trim()) {
      setError("Message is required.");
      return;
    }
    if (scope === "market_agents" && !targetMarket) {
      setError("Choose a market for market-agent targeting.");
      return;
    }
    if (scope === "specific_agents" && targetAgents.length === 0) {
      setError("Choose at least one agent.");
      return;
    }
    try {
      const result = await createBroadcast({
        message: messageText,
        targetScope: scope,
        targetMarketId: targetMarket ? (targetMarket as any) : undefined,
        targetAgentIds: scope === "specific_agents" ? (targetAgents as any) : undefined,
      });
      setMessage(`Broadcast queued for ${result.recipientCount} recipient(s).`);
      setMessageText("");
      setTargetMarket(""); setTargetAgents([]); setScope("all_agents");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send broadcast");
    }
  };

  const toggleAgent = (id: string) => {
    setTargetAgents((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]
    );
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Communications</h1>
          <p className="page-subtitle">Broadcast SMS to agents.</p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <div className="pf-stack">
        <div className="pf-panel">
          <h2>Send Broadcast</h2>
          <form onSubmit={handleSend} className="pf-form-grid" style={{ marginTop: 12 }}>
            <Field label="Message">
              <TextArea value={messageText} onChange={(e) => setMessageText(e.target.value)} rows={4} required />
            </Field>
            <Field label="Target">
              <Select value={scope} onChange={(e) => setScope(e.target.value as typeof scope)}>
                <option value="all_agents">All active agents</option>
                <option value="market_agents">Agents at a specific market</option>
                <option value="specific_agents">Specific agents</option>
              </Select>
            </Field>
            {scope === "market_agents" && (
              <Field label="Market">
                <Select value={targetMarket} onChange={(e) => setTargetMarket(e.target.value)} required>
                  <option value="" disabled>Select market…</option>
                  {markets.map((m) => <option key={m._id} value={m._id as string}>{m.name}</option>)}
                </Select>
              </Field>
            )}
            {scope === "specific_agents" && (
              <Field label="Agents">
                <div className="pf-checkbox-group">
                  {agents.map((a) => (
                    <label key={a._id} className="pf-checkbox">
                      <input type="checkbox" checked={targetAgents.includes(a._id)} onChange={() => toggleAgent(a._id)} />
                      {a.name}
                    </label>
                  ))}
                </div>
              </Field>
            )}
          </form>
          <div className="pf-form-actions">
            <button type="button" className="primary-button" onClick={handleSend}>Send SMS</button>
          </div>
        </div>

        <div className="pf-panel">
          <h2>Broadcast History</h2>
          {broadcasts.length === 0 ? (
            <EmptyState title="No broadcasts sent" />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th>Target</th>
                    <th className="pf-hide-sm">Recipients</th>
                    <th>Status</th>
                    <th className="pf-hide-sm">Sent</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {broadcasts.map((b) => (
                    <>
                      <tr key={b._id} onClick={() => setExpandedBroadcast(expandedBroadcast === b._id ? null : b._id)} style={{ cursor: "pointer" }}>
                        <td><strong>{b.message.slice(0, 60)}{b.message.length > 60 ? "…" : ""}</strong></td>
                        <td>{b.targetScope.replace(/_/g, " ")}</td>
                        <td className="pf-hide-sm">{b.recipientCount}</td>
                        <td><StatusPill tone={b.deliveryStatus === "sent" ? "success" : b.deliveryStatus === "failed" ? "danger" : "neutral"}>{b.deliveryStatus}</StatusPill></td>
                        <td className="pf-hide-sm">{formatDateTime(b.sentAt)}</td>
                        <td className="pf-actions">{expandedBroadcast === b._id ? "▼" : "▶"}</td>
                      </tr>
                      {expandedBroadcast === b._id && deliveryLogs && (
                        <tr>
                          <td colSpan={6}>
                            <div className="pf-table-wrap" style={{ margin: 8 }}>
                              <table className="pf-table">
                                <thead><tr><th>Agent</th><th>Phone</th><th>Status</th></tr></thead>
                                <tbody>
                                  {deliveryLogs.map((d) => (
                                    <tr key={d._id}>
                                      <td>{agents.find((a) => a._id === d.agentId)?.name ?? `#${String(d.agentId).slice(-6)}`}</td>
                                      <td>{d.phone}</td>
                                      <td><StatusPill tone={d.status === "delivered" ? "success" : d.status === "failed" ? "danger" : "neutral"}>{d.status}</StatusPill></td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
