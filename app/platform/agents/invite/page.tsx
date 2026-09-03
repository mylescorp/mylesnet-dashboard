"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field, Select, TextInput, StatusPill, EmptyState, Loading, ErrorNote, formatDateTime } from "../../components/ui";

export default function AgentInvitePage() {
  const invitations = useQuery(api.agentInvitations.listInvitations, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const createInvitation = useMutation(api.agentInvitations.createInvitation);
  const revokeInvitation = useMutation(api.agentInvitations.revokeInvitation);

  const [now] = useState(() => Date.now());

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [targetMarket, setTargetMarket] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);

  if (invitations === undefined || markets === undefined) return <Loading />;

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !email.trim() || !phone.trim()) {
      setError("Name, email and phone are required.");
      return;
    }
    try {
      const result = await createInvitation({
        name, email, phone,
        targetMarketId: targetMarket ? (targetMarket as Id<"markets">) : undefined,
      });
      setGeneratedToken(result.token);
      setMessage(`Invitation created. Expires ${formatDateTime(result.expiresAt)}.`);
      setName(""); setEmail(""); setPhone(""); setTargetMarket("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create invitation");
    }
  };

  const handleRevoke = async (id: Id<"agentInvitations">) => {
    setError(null);
    try {
      await revokeInvitation({ invitationId: id });
      setMessage("Invitation revoked.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not revoke invitation");
    }
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Invite Agent</h1>
          <p className="page-subtitle">One-time link, 7-day expiry, WorkOS-backed signup redirecting to /dashboard.</p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      {generatedToken && (
        <div className="pf-claim-banner" style={{ borderColor: "var(--success)" }}>
          <strong>Invitation link generated</strong>
          <code style={{ display: "block", margin: "8px 0", wordBreak: "break-all" }}>
            {`${window.location.origin}/agent-invite?token=${generatedToken}`}
          </code>
          <button type="button" className="secondary-button"
            onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/agent-invite?token=${generatedToken}`); setMessage("Link copied."); }}>
            Copy link
          </button>
        </div>
      )}

      <div className="pf-stack">
        <div className="pf-panel">
          <h2>New Invitation</h2>
          <form onSubmit={handleInvite} className="pf-form-grid" style={{ marginTop: 12 }}>
            <Field label="Full name"><TextInput value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Email"><TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></Field>
            <Field label="Phone"><TextInput value={phone} onChange={(e) => setPhone(e.target.value)} required /></Field>
            <Field label="Assign to market (optional)">
              <Select value={targetMarket} onChange={(e) => setTargetMarket(e.target.value)}>
                <option value="">Later</option>
                {markets.map((m) => <option key={m._id} value={m._id as string}>{m.name}</option>)}
              </Select>
            </Field>
          </form>
          <div className="pf-form-actions">
            <button type="button" className="primary-button" onClick={handleInvite}>Generate Invitation</button>
          </div>
        </div>

        <div className="pf-panel">
          <h2>Active Invitations</h2>
          {invitations.length === 0 ? (
            <EmptyState title="No invitations" />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Created</th>
                    <th>Expires</th>
                    <th className="pf-hide-sm">Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map((inv) => (
                    <tr key={inv._id}>
                      <td><strong>{inv.name}</strong></td>
                      <td>{inv.email}</td>
                      <td>{formatDateTime(inv.createdAt)}</td>
                      <td>{formatDateTime(inv.expiresAt)}</td>
                      <td className="pf-hide-sm">
                        <StatusPill tone={inv.acceptedAt ? "success" : now > inv.expiresAt ? "danger" : "neutral"}>
                          {inv.acceptedAt ? "Accepted" : now > inv.expiresAt ? "Expired" : "Pending"}
                        </StatusPill>
                      </td>
                      <td className="pf-actions">
                        {!inv.acceptedAt && now <= inv.expiresAt && (
                          <button type="button" className="secondary-button" onClick={() => handleRevoke(inv._id)}>Revoke</button>
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
    </div>
  );
}
