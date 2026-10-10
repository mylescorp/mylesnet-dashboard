"use client";

import { userFacingMessage } from "@/shared/lib/user-facing-error";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { featureFlags } from "@/lib/convex/featureFlags";
import { tenantControl } from "@/lib/convex/tenantControl";

const isSuperAdmin = (roles: { slug: string }[] | undefined) =>
  roles?.some(role => ["platform_super_admin", "platform_owner", "platform_admin"].includes(role.slug)) ?? false;

const isOps = (roles: { slug: string }[] | undefined) =>
  roles?.some(role => ["platform_ops", "ops_manager"].includes(role.slug)) ?? false;

export function PlatformFeatureFlagDetail({ flag }: { flag: string }) {
  const { user } = useUserProfile();
  const flagRow = useQuery(featureFlags.get, { key: flag });
  const { results: tenants, status: tenantPageStatus, loadMore: loadMoreTenants } = usePaginatedQuery(
    tenantControl.listPlatformTenantTargetsPage,
    {},
    { initialNumItems: 50 },
  );
  const setFlag = useMutation(featureFlags.set);
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [category, setCategory] = useState<"infrastructure" | "general" | undefined>(undefined);
  const [tenantOverride, setTenantOverride] = useState<string[] | undefined>(undefined);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const superAdmin = isSuperAdmin(user?.roles);
  const ops = isOps(user?.roles);

  if (flagRow === undefined) return <p className="pf-muted">Loading service control…</p>;
  if (flagRow === null) return <p className="pf-muted">The requested service control is unavailable.</p>;

  const editable = superAdmin || (ops && flagRow.category === "infrastructure");
  const currentCategory = category ?? flagRow.category ?? "general";
  const currentEnabled = enabled ?? flagRow.enabled;
  const currentPayload = flagRow.valueJson;

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">
            <Link href="/platform/feature-flags" className="platform-back-link">
              <ArrowLeft size={15} aria-hidden="true" />Service controls
            </Link>
          </p>
          <h1 className="page-title">{flagRow.description || "Service control"}</h1>
          <p className="page-subtitle">{flagRow.description || "No description"}</p>
        </div>
        <span className={`pf-badge ${flagRow.enabled ? "pf-badge-success" : "pf-badge-neutral"}`}>
          {flagRow.enabled ? "On" : "Off"}
        </span>
      </header>

      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
      {notice ? <p className="platform-notice" role="status">{notice}</p> : null}

      <section className="section-heading"><div><p className="eyebrow">Service control</p><h2>Configuration</h2></div></section>
      <p className="pf-hint">Scope: {flagRow.category === "infrastructure" ? "Infrastructure" : flagRow.category === "general" ? "General platform" : "Unclassified · super-admin only"}</p>

      <div className="form-grid">
        <div className="pf-field">
          <span className="pf-label">Availability</span>
          <select
            className="pf-input"
            disabled={!editable}
            value={currentEnabled ? "on" : "off"}
            onChange={(event) => setEnabled(event.target.value === "on")}
          >
            <option value="on">On</option>
            <option value="off">Off</option>
          </select>
        </div>
        {editable ? (
          <label className="pf-field pf-field-wide">
            <span className="pf-label">Description</span>
            <input
              className="pf-input"
              value={description ?? flagRow.description ?? ""}
              onChange={(event) => setDescription(event.target.value)}
            />
          </label>
        ) : null}
        {superAdmin ? <label className="pf-field"><span className="pf-label">Control scope</span><select className="pf-input" value={currentCategory} onChange={event => setCategory(event.target.value as "infrastructure" | "general")}><option value="general">General platform</option><option value="infrastructure">Infrastructure</option></select></label> : null}
        {editable ? (
          <label className="pf-field pf-field-wide">
            <span className="pf-label">Tenant override (empty = global rollout)</span>
            <select
              className="pf-input"
              size={4}
              multiple
              value={tenantOverride ?? flagRow.tenantIds ?? []}
              onChange={(event) => setTenantOverride(current => {
                const loadedIds = new Set((tenants ?? []).map(tenant => tenant._id));
                const preserved = (current ?? flagRow.tenantIds ?? []).filter(id => !loadedIds.has(id));
                const selected = Array.from(event.target.selectedOptions).map(option => option.value);
                return Array.from(new Set([...preserved, ...selected]));
              })}
            >
              {(tenants ?? []).map((tenant) => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name}
                </option>
              ))}
            </select>
            <small className="table-subtext">{tenants.length} tenant options loaded. Selected organizations outside the loaded options are preserved.</small>
            {tenantPageStatus === "CanLoadMore" || tenantPageStatus === "LoadingMore" ? <button type="button" className="secondary-button" disabled={tenantPageStatus === "LoadingMore"} onClick={() => loadMoreTenants(50)}>{tenantPageStatus === "LoadingMore" ? "Loading…" : "Load more tenants"}</button> : null}
          </label>
        ) : null}
      </div>

      {editable ? (
        <div className="modal-actions">
          <button
            type="button"
            className="primary-button"
            disabled={working}
            onClick={async () => {
              setError(null); setNotice(null); setWorking(true);
              try {
                await setFlag({
                  key: flagRow.key,
                  valueJson: currentPayload,
                  enabled: currentEnabled,
                  category: superAdmin ? currentCategory : undefined,
                  description: (description ?? flagRow.description) ?? undefined,
                  tenantIds: tenantOverride ?? flagRow.tenantIds ?? undefined,
                });
                setNotice("Service control saved.");
              } catch (caught) {
                setError(userFacingMessage(caught, "Save failed."));
              } finally {
                setWorking(false);
              }
            }}
          >
            <Save size={16} aria-hidden="true" />{working ? "Saving…" : "Save changes"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
