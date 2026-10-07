"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@/app/lib/convex";
import { platformMarkets, type PlatformMarket, type MarketLifecycle } from "@/shared/convex/platformMarkets";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import type { Id } from "@/convex/_generated/dataModel";

const lifecycleOptions: MarketLifecycle[] = ["planned", "active", "paused", "decommissioned"];
const managerRoles = new Set(["platform_super_admin", "platform_ops", "platform_owner", "platform_admin", "ops_manager"]);

export function PlatformMarkets({ tenantId }: { tenantId: Id<"tenants"> }) {
  const { user } = useUserProfile();
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<PlatformMarket | null>(null);
  const [form, setForm] = useState({ name: "", country: "", currency: "" });
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const markets = useQuery(platformMarkets.listForTenant, { tenantId, includeArchived });
  const createMarket = useMutation(platformMarkets.createForTenant);
  const updateMarket = useMutation(platformMarkets.updateForTenant);
  const setLifecycle = useMutation(platformMarkets.setLifecycle);
  const archiveMarket = useMutation(platformMarkets.softDeleteForTenant);
  const restoreMarket = useMutation(platformMarkets.restoreForTenant);
  const canManage = user?.roles.some(role => managerRoles.has(role.slug)) ?? false;

  async function saveMarket(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const input = form;
    setWorking(true); setError(""); setNotice("");
    try {
      if (editing) {
        await updateMarket({ tenantId, marketId: editing._id, ...input });
        setNotice("Market details updated.");
      } else {
        await createMarket({ tenantId, ...input });
        setNotice("Market created.");
      }
      setEditing(null);
      setForm({ name: "", country: "", currency: "" });
    } catch (cause) {
      setError(userFacingMessage(cause, "Market details could not be saved."));
    } finally { setWorking(false); }
  }

  async function changeLifecycle(market: PlatformMarket, lifecycleStatus: MarketLifecycle) {
    setWorking(true); setError(""); setNotice("");
    try {
      await setLifecycle({ tenantId, marketId: market._id, lifecycleStatus });
      setNotice(`Market status changed to ${lifecycleStatus}.`);
    } catch (cause) { setError(userFacingMessage(cause, "Market status could not be changed.")); }
    finally { setWorking(false); }
  }

  async function archive(market: PlatformMarket) {
    const reason = window.prompt(`Why are you archiving ${market.name}?`)?.trim();
    if (!reason) return;
    setWorking(true); setError(""); setNotice("");
    try {
      await archiveMarket({ tenantId, marketId: market._id, reason });
      setNotice("Market archived.");
    } catch (cause) { setError(userFacingMessage(cause, "Market could not be archived.")); }
    finally { setWorking(false); }
  }

  async function restore(market: PlatformMarket) {
    setWorking(true); setError(""); setNotice("");
    try {
      await restoreMarket({ tenantId, marketId: market._id });
      setNotice("Market restored.");
    } catch (cause) { setError(userFacingMessage(cause, "Market could not be restored.")); }
    finally { setWorking(false); }
  }

  return (
    <main className="workspace-page">
      <header className="page-heading">
        <div><p className="eyebrow"><Link href={`/platform/organizations/${tenantId}`}>Organization</Link></p><h1 className="page-title">Markets</h1><p className="page-subtitle">Manage the markets assigned to this organization.</p></div>
        <Link href={`/platform/organizations/${tenantId}`} className="secondary-button">Back to organization</Link>
      </header>
      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
      {canManage ? <form className="pf-panel" onSubmit={event => void saveMarket(event)} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 20 }}>
        <div className="section-heading" style={{ gridColumn: "1 / -1" }}><div><p className="eyebrow">{editing ? "Update" : "Create"}</p><h2>{editing ? "Edit market" : "New market"}</h2></div></div>
        <label className="pf-field"><span className="pf-label">Market name</span><input className="pf-input" name="name" required maxLength={120} value={form.name} onChange={event => setForm({ ...form, name: event.target.value })} /></label>
        <label className="pf-field"><span className="pf-label">Country</span><input className="pf-input" name="country" required maxLength={120} value={form.country} onChange={event => setForm({ ...form, country: event.target.value })} /></label>
        <label className="pf-field"><span className="pf-label">Currency code</span><input className="pf-input" name="currency" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={form.currency} onChange={event => setForm({ ...form, currency: event.target.value })} /></label>
        <div style={{ display: "flex", alignItems: "end", gap: 8 }}><button className="pf-button" disabled={working}>{working ? "Saving…" : editing ? "Save changes" : "Create market"}</button>{editing ? <button type="button" className="secondary-button" onClick={() => { setEditing(null); setForm({ name: "", country: "", currency: "" }); }}>Cancel</button> : null}</div>
      </form> : null}
      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Organization locations</p><h2>Market directory</h2></div><span className="section-count">{markets?.length ?? 0} markets</span></div>
        <label className="access-role-check"><input type="checkbox" checked={includeArchived} onChange={event => setIncludeArchived(event.target.checked)} /><span>Include archived markets</span></label>
        {markets === undefined ? <p className="pf-muted">Loading markets…</p> : markets.length === 0 ? <EmptyState title="No markets found" body="Markets created for this organization will appear here." /> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Name</th><th>Country</th><th>Currency</th><th>Lifecycle</th><th>Record</th>{canManage ? <th>Actions</th> : null}</tr></thead><tbody>
          {markets.map(market => <tr key={market._id}><td><strong>{market.name}</strong></td><td>{market.country}</td><td>{market.currency}</td><td>{market.status === "active" && canManage ? <select className="pf-input" aria-label={`Lifecycle for ${market.name}`} value={market.lifecycleStatus} disabled={working} onChange={event => void changeLifecycle(market, event.target.value as MarketLifecycle)}>{lifecycleOptions.map(value => <option key={value} value={value}>{value}</option>)}</select> : <StatusPill tone="neutral">{market.lifecycleStatus}</StatusPill>}</td><td><StatusPill tone={market.status === "active" ? "success" : "neutral"}>{market.status === "active" ? "Active" : "Archived"}</StatusPill></td>{canManage ? <td><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>{market.status === "active" ? <><button type="button" className="secondary-button" disabled={working} onClick={() => { setEditing(market); setForm({ name: market.name, country: market.country, currency: market.currency }); }}>Edit</button><button type="button" className="secondary-button" disabled={working} onClick={() => void archive(market)}>Archive</button></> : <button type="button" className="secondary-button" disabled={working} onClick={() => void restore(market)}>Restore</button>}</div></td> : null}</tr>)}
        </tbody></table></div>}
      </section>
    </main>
  );
}
