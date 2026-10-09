"use client";

import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { platformCommissionRates } from "@/shared/convex/platformCommissionRates";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

const MANAGERS = ["platform_super_admin", "platform_finance"];
export function PlatformCommissionRates() {
  const { user } = useUserProfile();
  const roles = user?.roles.map(role => role.slug) ?? [];
  const canManage = roles.some(role => MANAGERS.includes(role));
  const global = useQuery(platformCommissionRates.getGlobal, {});
  const { results: overrides, status: overrideStatus, loadMore: loadMoreOverrides } = usePaginatedQuery(platformCommissionRates.listOverrides, {}, { initialNumItems: 20 });
  const { results: agencies, status: agencyStatus, loadMore: loadMoreAgencies } = usePaginatedQuery(platformCommissionRates.agencyOptions, {}, { initialNumItems: 50 });
  const saveGlobal = useMutation(platformCommissionRates.saveGlobal);
  const create = useMutation(platformCommissionRates.create);
  const update = useMutation(platformCommissionRates.update);
  const remove = useMutation(platformCommissionRates.remove);
  const [globalRate, setGlobalRate] = useState<string | null>(null);
  const [globalDuration, setGlobalDuration] = useState<string | null>(null);
  const [agencyId, setAgencyId] = useState("");
  const [agencyRate, setAgencyRate] = useState("20");
  const [agencyDuration, setAgencyDuration] = useState("12");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const run = async (operation: () => Promise<unknown>, success: string) => {
    setBusy(true); setMessage(""); setError("");
    try { await operation(); setMessage(success); }
    catch (cause) { setError(userFacingMessage(cause, "Commission policy could not be saved.")); }
    finally { setBusy(false); }
  };
  if (!canManage) return <main className="workspace-page"><h1 className="page-title">Access restricted</h1><p className="page-subtitle">Commission rates can only be managed by platform finance and super-admin roles.</p></main>;
  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Commission configuration</p><h1 className="page-title">Referral commission rates</h1><p className="page-subtitle">Global referral default and per-agency overrides.</p></div></header>
    <p className="pf-hint">The built-in default is 20% for 12 months, matching the approved public referral contract. These policies configure future referral accruals; the repository does not yet contain a referral attribution or subscription commission payout pipeline. Voucher-agent rates remain managed on agent-market assignments.</p>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Global default</p><h2>Referral terms</h2></div></div>
      {global === undefined ? <p className="pf-muted">Loading rates…</p> : <form className="form-grid" onSubmit={event => { event.preventDefault(); void run(() => saveGlobal({ rateBasisPoints: Math.round(Number(globalRate === null ? global.rateBasisPoints : Number(globalRate) * 100)), durationMonths: Number(globalDuration ?? global.durationMonths) }), "Global referral policy saved."); }}>
        <label className="pf-field"><span className="pf-label">Commission rate (%)</span><input className="pf-input" type="number" min="0" max="100" step="0.01" value={globalRate ?? String(global.rateBasisPoints / 100)} onChange={e => setGlobalRate(e.target.value)} /></label>
        <label className="pf-field"><span className="pf-label">Duration (months)</span><input className="pf-input" type="number" min="1" max="60" step="1" value={globalDuration ?? String(global.durationMonths)} onChange={e => setGlobalDuration(e.target.value)} /></label>
        <div className="modal-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save global default"}</button></div>
      </form>}
    </section>
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Overrides</p><h2>Agency-specific rates</h2></div><span className="section-count">{overrides.length} loaded</span></div>
      <form className="form-grid" onSubmit={event => { event.preventDefault(); if (!agencyId) return; void run(async () => { await create({ scope: "agency", relationshipId: agencyId, rateBasisPoints: Math.round(Number(agencyRate) * 100), durationMonths: Number(agencyDuration) }); setAgencyId(""); }, "Agency override created."); }}>
        <label className="pf-field"><span className="pf-label">Agency</span><select className="pf-input" value={agencyId} onChange={e => setAgencyId(e.target.value)}><option value="">Choose agency</option>{agencies?.map(row => <option key={row.id} value={row.id}>{row.name}{row.status === "suspended" ? " · suspended" : ""}</option>)}</select></label>
        <label className="pf-field"><span className="pf-label">Rate (%)</span><input className="pf-input" type="number" min="0" max="100" step="0.01" value={agencyRate} onChange={e => setAgencyRate(e.target.value)} /></label>
        <label className="pf-field"><span className="pf-label">Duration (months)</span><input className="pf-input" type="number" min="1" max="60" step="1" value={agencyDuration} onChange={e => setAgencyDuration(e.target.value)} /></label>
        <div className="modal-actions"><button className="primary-button" disabled={busy || !agencyId}>Add override</button>{agencyStatus === "CanLoadMore" || agencyStatus === "LoadingMore" ? <button className="secondary-button" type="button" onClick={() => loadMoreAgencies(50)} disabled={agencyStatus === "LoadingMore"}>Load more agencies</button> : null}</div>
      </form>
      {overrides.length ? <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Agency</th><th>Rate</th><th>Duration</th><th>Actions</th></tr></thead><tbody>{overrides.map(row => <tr key={row.id}><td>{row.agencyName ?? "Unavailable agency"}</td><td><input aria-label={`${row.agencyName} commission rate percentage`} className="pf-input" type="number" min="0" max="100" step="0.01" defaultValue={(row.rateBasisPoints / 100).toFixed(2)} id={`rate-${row.id}`} /></td><td><input aria-label={`${row.agencyName} commission duration months`} className="pf-input" type="number" min="1" max="60" defaultValue={row.durationMonths} id={`duration-${row.id}`} /></td><td><button className="secondary-button" disabled={busy} onClick={() => { const rate = Number((document.getElementById(`rate-${row.id}`) as HTMLInputElement).value); const duration = Number((document.getElementById(`duration-${row.id}`) as HTMLInputElement).value); void run(() => update({ id: row.id, rateBasisPoints: Math.round(rate * 100), durationMonths: duration }), "Agency override updated."); }}>Save</button> <button className="secondary-button" disabled={busy} onClick={() => { if (window.confirm(`Remove the override for ${row.agencyName ?? "this agency"}? It will inherit the global rate.`)) void run(() => remove({ id: row.id }), "Agency override removed."); }}>Remove</button></td></tr>)}</tbody></table></div> : overrideStatus === "LoadingFirstPage" ? <p className="pf-muted">Loading agency overrides…</p> : <p className="pf-muted">No agency-specific overrides are configured.</p>}
      {overrideStatus === "CanLoadMore" || overrideStatus === "LoadingMore" ? <div className="modal-actions"><button type="button" className="secondary-button" onClick={() => loadMoreOverrides(20)} disabled={overrideStatus === "LoadingMore"}>{overrideStatus === "LoadingMore" ? "Loading…" : "Load more overrides"}</button></div> : null}
    </section>
  </main>;
}
