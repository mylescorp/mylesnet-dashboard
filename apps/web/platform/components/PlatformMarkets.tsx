"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@/app/lib/convex";
import { platformMarkets } from "@/shared/convex/platformMarkets";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { canManagePlatformTenants } from "@/platform/permissions";
import { EmptyState, StatusPill } from "@/shared/components/ui";

export function PlatformMarkets({ tenantId }: { tenantId: string }) {
  const { user } = useUserProfile();
  const [showArchived, setShowArchived] = useState(false);
  const rows = useQuery(platformMarkets.listForTenant, { tenantId, includeArchived: showArchived });
  const create = useMutation(platformMarkets.createForTenant);
  const setLifecycle = useMutation(platformMarkets.setLifecycle);
  const updateMarket = useMutation(platformMarkets.updateForTenant);
  const archiveMarket = useMutation(platformMarkets.softDeleteForTenant);
  const restoreMarket = useMutation(platformMarkets.restoreForTenant);
  const canManage = canManagePlatformTenants(user?.roles.map(role => role.slug));
  const [name, setName] = useState("");
  const [country, setCountry] = useState("");
  const [currency, setCurrency] = useState("KES");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  async function addMarket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      await create({ tenantId, name, country, currency: currency.toUpperCase() });
      setName("");
      setCountry("");
      setMessage("Market added.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Market could not be added.");
    } finally {
      setBusy(false);
    }
  }

  async function changeLifecycle(marketId: string, lifecycleStatus: "planned" | "active" | "paused" | "decommissioned") {
    setMessage("");
    try {
      await setLifecycle({ tenantId, marketId, lifecycleStatus });
      setMessage("Market lifecycle updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Market lifecycle could not be updated.");
    }
  }

  async function archive(marketId: string, marketName: string) {
    if (!window.confirm(`Archive ${marketName}? You can restore it later.`)) return;
    setMessage("");
    try {
      await archiveMarket({ tenantId, marketId, reason: "Archived by platform operations" });
      setMessage("Market archived.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Market could not be archived.");
    }
  }

  async function restore(marketId: string) {
    setMessage("");
    try {
      await restoreMarket({ tenantId, marketId });
      setMessage("Market restored.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Market could not be restored.");
    }
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>, marketId: string) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setMessage("");
    try {
      await updateMarket({
        tenantId,
        marketId,
        name: String(data.get("name")),
        country: String(data.get("country")),
        currency: String(data.get("currency")).toUpperCase(),
      });
      setEditing(null);
      setMessage("Market updated.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Market could not be updated.");
    }
  }

  return (
    <main className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow"><Link href={`/platform/organizations/${tenantId}`}>Organization</Link></p>
          <h1 className="page-title">Markets</h1>
          <p className="page-subtitle">Manage markets attached to this tenant organization.</p>
        </div>
      </header>
      {message ? <p className="platform-claim-message" role="status">{message}</p> : null}
      {canManage ? (
        <form className="pf-panel" onSubmit={addMarket} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", marginBottom: 20 }}>
          <label>Market name<input required maxLength={120} value={name} onChange={event => setName(event.target.value)} /></label>
          <label>Country<input required maxLength={120} value={country} onChange={event => setCountry(event.target.value)} /></label>
          <label>Currency<input required minLength={3} maxLength={3} value={currency} onChange={event => setCurrency(event.target.value)} /></label>
          <button className="pf-button" disabled={busy}>{busy ? "Adding…" : "Add market"}</button>
        </form>
      ) : null}
      <section className="pf-panel">
        <div className="section-heading">
          <div><p className="eyebrow">Organization footprint</p><h2>Markets</h2></div>
          <span className="section-count">{rows?.length ?? 0}</span>
        </div>
        {canManage ? <button type="button" className="secondary-button" aria-pressed={showArchived} onClick={() => setShowArchived(value => !value)}>{showArchived ? "Hide archived" : "Show archived"}</button> : null}
        {rows === undefined ? <p className="pf-muted">Loading markets…</p> : rows.length === 0 ? (
          <EmptyState title={showArchived ? "No archived markets" : "No markets yet"} body={showArchived ? "Archived markets will appear here." : "Markets created for this organization will appear here."} />
        ) : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Market</th><th>Country</th><th>Currency</th><th>Lifecycle</th>{canManage ? <th>Actions</th> : null}</tr></thead><tbody>
            {rows.map(row => (
              <tr key={row._id}>
                <td><strong>{row.name}</strong>{row.status === "deleted" ? <small className="table-subtext">Archived</small> : null}</td>
                <td>{row.country}</td><td>{row.currency}</td>
                <td><StatusPill tone={row.lifecycleStatus === "active" ? "success" : row.lifecycleStatus === "paused" ? "warning" : "neutral"}>{row.lifecycleStatus}</StatusPill></td>
                {canManage ? <td>
                  {row.status === "deleted" ? <button type="button" className="secondary-button" onClick={() => void restore(row._id)}>Restore</button> : <>
                    <select aria-label={`Lifecycle for ${row.name}`} value={row.lifecycleStatus} onChange={event => void changeLifecycle(row._id, event.target.value as typeof row.lifecycleStatus)}><option value="planned">Planned</option><option value="active">Active</option><option value="paused">Paused</option><option value="decommissioned">Decommissioned</option></select>
                    <button type="button" className="pf-button pf-button-compact" onClick={() => setEditing(editing === row._id ? null : row._id)}>{editing === row._id ? "Close" : "Edit"}</button>
                    <button type="button" className="secondary-button" onClick={() => void archive(row._id, row.name)}>Archive</button>
                    {editing === row._id ? <form onSubmit={event => void saveEdit(event, row._id)}><input name="name" aria-label="Market name" defaultValue={row.name} required maxLength={120} /><input name="country" aria-label="Country" defaultValue={row.country} required maxLength={120} /><input name="currency" aria-label="Currency" defaultValue={row.currency} required minLength={3} maxLength={3} /><button className="pf-button pf-button-compact">Save</button></form> : null}
                  </>}
                </td> : null}
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>
    </main>
  );
}
