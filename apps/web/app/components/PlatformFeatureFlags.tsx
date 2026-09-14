"use client";

import { useState } from "react";
import { Flag, Plus, Save, Trash2 } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "./UserProfileContext";
import { featureFlags, type FeatureFlag } from "@/lib/convex/featureFlags";
import { tenantControl } from "@/lib/convex/tenantControl";

const canManageFlag = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) =>
    ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug),
  );

const canDeleteFlag = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) => ["platform_owner", "platform_admin"].includes(role.slug));

export function PlatformFeatureFlags() {
  const { user } = useUserProfile();
  const flags = useQuery(featureFlags.list, {});
  const tenants = useQuery(tenantControl.listForPlatform, {});
  const setFlag = useMutation(featureFlags.set);
  const removeFlag = useMutation(featureFlags.remove);
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<FeatureFlag | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const canManage = canManageFlag(user?.roles);
  const canDelete = canDeleteFlag(user?.roles);

  const active = flags?.filter((flag) => flag.enabled) ?? [];
  const rolledOut = flags?.filter((flag) => flag.enabled && flag.tenantIds && flag.tenantIds.length > 0) ?? [];

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Feature flags</h1>
          <p className="page-subtitle">
            Percentage rollouts and per-tenant overrides for platform capabilities.
          </p>
        </div>
        {canManage ? (
          <button type="button" className="primary-button" onClick={() => setCreating(true)}>
            <Plus size={17} aria-hidden="true" />Create flag
          </button>
        ) : null}
      </header>

      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
      {notice ? <p className="platform-notice" role="status">{notice}</p> : null}

      <section className="metric-grid" aria-label="Feature flag summary">
        <Metric label="Flags" value={flags?.length ?? "—"} detail="total defined" />
        <Metric label="Active" value={active.length} detail="enabled now" />
        <Metric label="Rollouts" value={rolledOut.length} detail="tenant-ratio flags" />
        <Metric label="Toggles open to you" value={canManage ? "Full" : "Read-only"} detail={canManage ? "super_admin + ops" : "view flags"} />
      </section>

      <section className="section-heading"><div><p className="eyebrow">Flags</p><h2>Gate catalog</h2></div><span className="section-count">{flags?.length ?? 0} flags</span></section>

      {flags === undefined ? (
        <p className="pf-muted">Loading flags…</p>
      ) : flags.length === 0 ? (
        <div className="tenant-empty-state">
          <Flag size={26} aria-hidden="true" />
          <h3>No feature flags yet</h3>
          <p>Create a flag to gate a capability behind a rollout or tenant override.</p>
        </div>
      ) : (
        <div className="tenant-list">
          {flags.map((flag) => (
            <div key={flag._id} className="tenant-card">
              <div className="tenant-card-main">
                <div className="tenant-card-title-row">
                  <h3>{flag.key}</h3>
                  <span className={`pf-badge ${flag.enabled ? "pf-badge-success" : "pf-badge-neutral"}`}>
                    {flag.enabled ? "On" : "Off"}
                  </span>
                </div>
                <p className="tenant-card-meta">{flag.description || "No description"}</p>
                <p className="tenant-card-meta">
                  {flag.tenantIds && flag.tenantIds.length > 0
                    ? `Override: ${flag.tenantIds.length} tenant${flag.tenantIds.length === 1 ? "" : "s"}`
                    : flag.valueJson.includes("rolloutPercent")
                      ? `Rollout: ${flag.valueJson.match(/"rolloutPercent"\s*:\s*(\d+)/)?.[1] ?? "?"}%`
                      : "Global toggle"}
                </p>
              </div>
              {canManage ? (
                <div className="tenant-card-actions">
                  <button type="button" className="secondary-button" onClick={() => setEditing(flag)}>Edit</button>
                  {canDelete ? (
                    <button
                      type="button"
                      className="secondary-button"
                      aria-label={`Delete ${flag.key}`}
                      onClick={async () => {
                        setError(null); setNotice(null);
                        try {
                          await removeFlag({ key: flag.key });
                          setNotice(`Deleted ${flag.key}.`);
                        } catch (caught) {
                          setError(caught instanceof Error ? caught.message : "Delete failed.");
                        }
                      }}
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      )}

      {creating || editing ? (
        <FlagEditor
          flag={editing}
          tenants={tenants ?? []}
          onClose={() => { setCreating(false); setEditing(null); }}
          onSave={async (input) => {
            setError(null); setNotice(null);
            try {
              const id = await setFlag(input);
              setCreating(false); setEditing(null);
              setNotice(`Saved ${input.key}.`);
              return { ok: true, id };
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Save failed.");
              return { ok: false, id: null };
            }
          }}
        />
      ) : null}
    </div>
  );
}

function Metric({ label, value, detail }: { label: string; value: string | number; detail: string }) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}

function FlagEditor(
  { flag, tenants, onClose, onSave }: {
    flag: FeatureFlag | null;
    tenants: { _id: string; name: string }[];
    onClose: () => void;
    onSave: (input: {
      key: string; valueJson: string; enabled: boolean; description?: string; tenantIds?: string[];
    }) => Promise<{ ok: boolean; id: string | null }>;
  },
) {
  const initial = flag ?? { key: "" } as FeatureFlag;
  const parsed = flag ? safeParse(flag.valueJson) : null;
  const [key, setKey] = useState(initial.key);
  const [description, setDescription] = useState(flag?.description ?? "");
  const [enabled, setEnabled] = useState(flag?.enabled ?? true);
  const [mode, setMode] = useState<"global" | "tenantOverride" | "rollout">(
    flag && flag.tenantIds && flag.tenantIds.length > 0
      ? "tenantOverride"
      : flag && (parsed?.rolloutPercent != null)
        ? "rollout"
        : "global",
  );
  const [rolloutPercent, setRolloutPercent] = useState<number>(
    typeof parsed?.rolloutPercent === "number" ? parsed.rolloutPercent : 50,
  );
  const [tenantIds, setTenantIds] = useState<string[]>(flag?.tenantIds ?? []);
  const [payload, setPayload] = useState(flag ? flag.valueJson : "");
  const [working, setWorking] = useState(false);

  const buildValueJson = () => {
    if (mode === "rollout") {
      const base = payload ? safeParse(payload) : {};
      return JSON.stringify({ ...(typeof base === "object" && base !== null ? base : {}), rolloutPercent });
    }
    return payload || "{}";
  };

  return (
    <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Feature flag editor" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <form className="profile-modal-dialog" onSubmit={async (event) => {
        event.preventDefault();
        setWorking(true);
        await onSave({
          key: key.trim(),
          valueJson: buildValueJson(),
          enabled,
          description: description.trim() || undefined,
          tenantIds: mode === "tenantOverride" ? tenantIds : undefined,
        });
        setWorking(false);
      }}>
        <header className="profile-modal-header">
          <div>
            <p className="eyebrow">Feature flags</p>
            <h2 className="page-title">{flag ? `Edit ${flag.key}` : "Create a flag"}</h2>
          </div>
          <button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">×</button>
        </header>
        <div className="modal-body">
          <div className="form-grid">
            <label className="pf-field">
              <span className="pf-label">Key</span>
              <input className="pf-input" required disabled={Boolean(flag)} pattern="^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)*$" value={key} onChange={(event) => setKey(event.target.value)} placeholder="e.g. billing.invoice.multi-currency" />
            </label>
            <label className="pf-field pf-field-wide">
              <span className="pf-label">Description</span>
              <input className="pf-input" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What does this flag gate?" />
            </label>
            <label className="pf-field">
              <span className="pf-label">Default state</span>
              <select className="pf-input" value={enabled ? "on" : "off"} onChange={(event) => setEnabled(event.target.value === "on")}>
                <option value="on">On</option>
                <option value="off">Off</option>
              </select>
            </label>
            <label className="pf-field">
              <span className="pf-label">Rollout strategy</span>
              <select className="pf-input" value={mode} onChange={(event) => setMode(event.target.value as typeof mode)}>
                <option value="global">Global toggle</option>
                <option value="rollout">Percentage rollout</option>
                <option value="tenantOverride">Per-tenant override</option>
              </select>
            </label>
            {mode === "rollout" ? (
              <label className="pf-field">
                <span className="pf-label">Rollout percent (0-100)</span>
                <input className="pf-input" type="number" min={0} max={100} value={rolloutPercent} onChange={(event) => setRolloutPercent(Number(event.target.value))} />
              </label>
            ) : null}
            {mode === "tenantOverride" ? (
              <label className="pf-field pf-field-wide">
                <span className="pf-label">Allowed tenants</span>
                <select className="pf-input" size={4} multiple value={tenantIds} onChange={(event) => {
                  const options = Array.from(event.target.selectedOptions).map((option) => option.value);
                  setTenantIds(options);
                }}>
                  {tenants.map((tenant) => <option key={tenant._id} value={tenant._id}>{tenant.name}</option>)}
                </select>
              </label>
            ) : null}
            <label className="pf-field pf-field-wide">
              <span className="pf-label">JSON payload</span>
              <textarea className="pf-input pf-input-code" rows={4} value={payload} onChange={(event) => setPayload(event.target.value)} placeholder={mode === "rollout" ? '{"feature": true}' : '{}'} />
            </label>
          </div>
          <div className="modal-actions">
            <button type="button" className="secondary-button" onClick={onClose}>Cancel</button>
            <button type="submit" className="primary-button" disabled={working}>
              <Save size={16} aria-hidden="true" />{working ? "Saving…" : flag ? "Save changes" : "Create flag"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function safeParse(value: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed as Record<string, unknown> : null;
  } catch {
    return null;
  }
}