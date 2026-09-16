"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { tenantMarkets, type MarketLifecycleStatus, type TenantMarket } from "@/lib/convex/tenantMarkets";
import { useUserProfile } from "./UserProfileContext";
import { EmptyState, StatusPill, formatDateTime } from "./ui";

const lifecycleTone: Record<MarketLifecycleStatus, "success" | "warning" | "danger" | "neutral"> = {
  active: "success",
  planned: "warning",
  paused: "warning",
  decommissioned: "neutral",
};

const LIFECYCLE_OPTIONS: MarketLifecycleStatus[] = ["planned", "active", "paused", "decommissioned"];

export function PlatformTenantMarkets({ tenantId }: { tenantId: string }) {
  const { user } = useUserProfile();
  const markets = useQuery(tenantMarkets.listForTenant, { tenantId });
  const createMarket = useMutation(tenantMarkets.createForTenant);
  const setLifecycle = useMutation(tenantMarkets.setLifecycleForTenant);
  const softDelete = useMutation(tenantMarkets.softDeleteForTenant);
  const restore = useMutation(tenantMarkets.restoreForTenant);

  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState<TenantMarket | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = user?.roles.some((role) => ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug));

  const run = async <T,>(fn: () => Promise<T>, successMessage: string) => {
    setError(null); setNotice(null);
    try {
      await fn();
      setNotice(successMessage);
      return true;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Market operation failed.");
      return false;
    }
  };

  const changeLifecycle = async (market: TenantMarket, lifecycleStatus: MarketLifecycleStatus) => {
    setWorkingId(market._id);
    await run(() => setLifecycle({ tenantId, marketId: market._id, lifecycleStatus }), `${market.name} moved to ${lifecycleStatus}.`);
    setWorkingId(null);
  };

  const restoreMarket = async (market: TenantMarket) => {
    setWorkingId(market._id);
    await run(() => restore({ tenantId, marketId: market._id }), `${market.name} was restored.`);
    setWorkingId(null);
  };

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow"><Link href={`/platform/tenants/${tenantId}`} className="platform-back-link"><ArrowLeft size={15} aria-hidden="true" />Tenant</Link></p>
          <h1 className="page-title">Markets</h1>
          <p className="page-subtitle">Platform-managed markets for this tenant: provisioning state, lifecycle, and soft-delete control.</p>
        </div>
        {canManage ? <button type="button" className="primary-button" onClick={() => { setError(null); setNotice(null); setCreating(true); }}><Plus size={17} aria-hidden="true" />New market</button> : null}
      </header>

      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Market roster</p><h2>Tenant markets</h2></div><span className="section-count">{markets?.length ?? 0} total</span></div>
        {markets === undefined ? <p className="pf-muted">Loading markets…</p> : markets.length === 0 ? (
          <EmptyState title="No markets yet" body="Create the tenant's first market to start scoping devices, agents and operations." />
        ) : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Market</th><th>Country</th><th>Currency</th><th>Lifecycle</th><th>Status</th><th>Created</th><th /></tr></thead><tbody>
            {markets.map((market) => (
              <tr key={market._id}>
                <td><strong>{market.name}</strong>{market.deleteReason ? <small className="table-subtext">{market.deleteReason}</small> : null}</td>
                <td>{market.country}</td>
                <td>{market.currency}</td>
                <td>{market.deletedAt === undefined ? (
                  canManage ? (
                    <select className="pf-input" value={market.lifecycleStatus} disabled={workingId === market._id} onChange={(event) => void changeLifecycle(market, event.target.value as MarketLifecycleStatus)}>
                      {LIFECYCLE_OPTIONS.map((option) => <option key={option} value={option}>{option}</option>)}
                    </select>
                  ) : <span className="status-pill status-pill-neutral">{market.lifecycleStatus}</span>
                ) : <span className="status-pill status-pill-danger">deleted</span>}</td>
                <td>{market.deletedAt === undefined ? <StatusPill tone={lifecycleTone[market.lifecycleStatus]}>{market.status}</StatusPill> : <StatusPill tone="danger">soft-deleted</StatusPill>}</td>
                <td>{formatDateTime(market.createdAt)}</td>
                <td><div className="cell-actions">{market.deletedAt === undefined ? (
                  canManage ? <button type="button" className="secondary-button" disabled={workingId === market._id} onClick={() => setDeleting(market)}><Trash2 size={14} aria-hidden="true" />Delete</button> : null
                ) : (
                  canManage ? <button type="button" className="secondary-button" disabled={workingId === market._id} onClick={() => void restoreMarket(market)}><RotateCcw size={14} aria-hidden="true" />Restore</button> : null
                )}</div></td>
              </tr>
            ))}
          </tbody></table></div>
        )}
      </section>

      {creating ? <CreateMarketDialog onClose={() => setCreating(false)} onCreate={async (values) => { const created = await run(() => createMarket({ tenantId, ...values }), `${values.name} was created as a planned market.`); if (created) setCreating(false); }} /> : null}
      {deleting ? <DeleteMarketDialog market={deleting} onClose={() => setDeleting(null)} onDelete={async (reason, forceCascade) => { const target = deleting._id; setDeleting(null); const done = await run(() => softDelete({ tenantId, marketId: target, deleteReason: reason, forceCascade }), `${deleting.name} was soft-deleted.`); if (!done) setDeleting(deleting); }} /> : null}
    </div>
  );
}

function CreateMarketDialog({ onClose, onCreate }: { onClose: () => void; onCreate: (values: { name: string; country: string; currency: string }) => Promise<void> }) {
  const [form, setForm] = useState({ name: "", country: "KE", currency: "KES" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setWorking(true);
    try {
      if (!form.name.trim()) throw new Error("Give the market a name.");
      if (!/^[A-Z]{2}$/.test(form.country)) throw new Error("Use a two-letter country code.");
      if (!/^[A-Z]{3}$/.test(form.currency)) throw new Error("Use a three-letter ISO-4217 currency code.");
      await onCreate(form);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create the market.");
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="New market" onClick={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
      <form className="profile-modal-dialog" onSubmit={save}>
        <header className="profile-modal-header"><div><p className="eyebrow">Platform markets</p><h2 className="page-title">New market</h2></div><button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header>
        <div className="modal-body">{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
          <div className="form-grid">
            <label className="pf-field"><span className="pf-label">Name</span><input className="pf-input" required value={form.name} onChange={(event) => change("name", event.target.value)} /></label>
            <label className="pf-field"><span className="pf-label">Country code</span><input className="pf-input" required maxLength={2} value={form.country} onChange={(event) => change("country", event.target.value.toUpperCase())} /></label>
            <label className="pf-field"><span className="pf-label">Currency</span><input className="pf-input" required maxLength={3} value={form.currency} onChange={(event) => change("currency", event.target.value.toUpperCase())} /></label>
          </div>
          <button type="submit" className="primary-button" disabled={working} style={{ marginTop: 16 }}>Create market</button>
        </div>
      </form>
    </div>
  );
}

function DeleteMarketDialog({ market, onClose, onDelete }: { market: TenantMarket; onClose: () => void; onDelete: (reason: string, forceCascade: boolean) => Promise<void> }) {
  const [reason, setReason] = useState("");
  const [forceCascade, setForceCascade] = useState(false);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setWorking(true);
    try {
      if (!reason.trim()) throw new Error("A delete reason is required.");
      await onDelete(reason, forceCascade);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not delete the market.");
    } finally {
      setWorking(false);
    }
  };
  return (
    <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Delete market" onClick={(event) => { if (event.target === event.currentTarget && !working) onClose(); }}>
      <form className="profile-modal-dialog" onSubmit={save}>
        <header className="profile-modal-header"><div><p className="eyebrow">Platform markets</p><h2 className="page-title">Delete “{market.name}”</h2></div><button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header>
        <div className="modal-body">{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
          <p className="pf-hint">Soft delete only — the market record is retained. Active devices and agent assignments must be reassigned first, or deleted together via the cascade.</p>
          <label className="pf-field"><span className="pf-label">Delete reason</span><textarea className="pf-input" required value={reason} onChange={(event) => setReason(event.target.value)} rows={2} /></label>
          <label className="pf-field pf-check-row"><input type="checkbox" checked={forceCascade} onChange={(event) => setForceCascade(event.target.checked)} /><span className="pf-label">Cascade: also soft-delete active devices and end active assignments for this market</span></label>
          <button type="submit" className="secondary-button" disabled={working} style={{ marginTop: 16 }}>Soft-delete market</button>
        </div>
      </form>
    </div>
  );
}