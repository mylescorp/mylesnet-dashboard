"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Field, Select, TextInput, TextArea, StatusPill, EmptyState, Loading, ErrorNote, formatDate } from "@/app/components/ui";

const pipelineTone: Record<string, "neutral" | "warning" | "danger" | "success"> = {
  prospect: "neutral",
  negotiating: "warning",
  provisioning: "danger",
  live: "success",
};
type PipelineStatus = "prospect" | "negotiating" | "provisioning" | "live";

export default function ProspectsPage() {
  const prospects = useQuery(api.marketProspects.listMarketProspects, {});
  const create = useMutation(api.marketProspects.createMarketProspect);
  const update = useMutation(api.marketProspects.updateMarketProspect);
  const convert = useMutation(api.marketProspects.convertProspectToMarket);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>("all");

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState<"UGX" | "KSH">("UGX");
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [notes, setNotes] = useState("");

  if (prospects === undefined) return <Loading />;

  const visible = filter === "all" ? prospects : prospects.filter((p) => p.pipelineStatus === filter);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim() || !country.trim()) {
      setError("Name and country are required.");
      return;
    }
    try {
      await create({ name, country, currency, contactName: contactName || undefined, contactPhone: contactPhone || undefined, contactEmail: contactEmail || undefined, notes: notes || undefined });
      setMessage("Prospect created.");
      setShowForm(false);
      setName(""); setCountry(""); setContactName(""); setContactPhone(""); setContactEmail(""); setNotes("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create prospect");
    }
  };

  const handleAdvance = async (prospectId: string, current: string) => {
    const next = current === "prospect" ? "negotiating" : current === "negotiating" ? "provisioning" : "live";
    try {
      if (next === "live") {
        const result = await convert({ prospectId: prospectId as Id<"marketProspects"> });
        setMessage(`Converted to market ${String(result.marketId).slice(-6)}.`);
      } else {
        await update({ prospectId: prospectId as Id<"marketProspects">, pipelineStatus: next as PipelineStatus });
        setMessage(`Advanced to ${next}.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not advance prospect");
    }
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Expansion Pipeline</h1>
          <p className="page-subtitle">Prospects not yet operational — separate from live markets.</p>
        </div>
        <button type="button" className="primary-button" onClick={() => setShowForm(!showForm)}>
          {showForm ? "Cancel" : "+ New Prospect"}
        </button>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      {showForm && (
        <div className="pf-panel">
          <h2>New Prospect</h2>
          <form onSubmit={handleCreate} className="pf-form-grid" style={{ marginTop: 12 }}>
            <Field label="Name"><TextInput value={name} onChange={(e) => setName(e.target.value)} required /></Field>
            <Field label="Country"><TextInput value={country} onChange={(e) => setCountry(e.target.value)} required /></Field>
            <Field label="Currency">
              <Select value={currency} onChange={(e) => setCurrency(e.target.value as "UGX" | "KSH")}>
                <option value="UGX">UGX</option>
                <option value="KSH">KSH</option>
              </Select>
            </Field>
            <Field label="Contact name"><TextInput value={contactName} onChange={(e) => setContactName(e.target.value)} /></Field>
            <Field label="Contact phone"><TextInput value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} /></Field>
            <Field label="Contact email"><TextInput value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} /></Field>
            <Field label="Notes"><TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} /></Field>
          </form>
          <div className="pf-form-actions">
            <button type="button" className="primary-button" onClick={handleCreate}>Create Prospect</button>
          </div>
        </div>
      )}

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          {["all", "prospect", "negotiating", "provisioning", "live"].map((s) => (
            <button key={s} type="button" className={filter === s ? "primary-button" : "secondary-button"} onClick={() => setFilter(s)}>
              {s === "all" ? `All (${prospects.length})` : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="pf-panel">
        {visible.length === 0 ? (
          <EmptyState title="No prospects" body="Add a new prospect to start the expansion pipeline." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Country</th>
                  <th>Status</th>
                  <th className="pf-hide-sm">Contact</th>
                  <th className="pf-hide-sm">Created</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {visible.map((p) => (
                  <tr key={p._id}>
                    <td><strong>{p.name}</strong></td>
                    <td>{p.country}</td>
                    <td><StatusPill tone={pipelineTone[p.pipelineStatus]}>{p.pipelineStatus}</StatusPill></td>
                    <td className="pf-hide-sm">{p.contactPhone ?? p.contactEmail ?? "—"}</td>
                    <td className="pf-hide-sm">{formatDate(p.createdAt)}</td>
                    <td className="pf-actions">
                      {p.pipelineStatus !== "live" && (
                        <button type="button" className="primary-button" onClick={() => handleAdvance(p._id, p.pipelineStatus)}>
                          {p.pipelineStatus === "provisioning" ? "Convert to Market" : "Advance"}
                        </button>
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
