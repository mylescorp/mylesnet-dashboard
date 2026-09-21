"use client";

import { userFacingMessage } from "@/shared/lib/user-facing-error";

import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { featureFlags } from "@/lib/convex/featureFlags";
import { tenantControl } from "@/lib/convex/tenantControl";

const canManage = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) =>
    ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug),
  );

export function PlatformFeatureFlagDetail({ flag }: { flag: string }) {
  const { user } = useUserProfile();
  const flagRow = useQuery(featureFlags.get, { key: flag });
  const tenants = useQuery(tenantControl.listForPlatform, {});
  const setFlag = useMutation(featureFlags.set);
  const [enabled, setEnabled] = useState<boolean | undefined>(undefined);
  const [description, setDescription] = useState<string | undefined>(undefined);
  const [tenantOverride, setTenantOverride] = useState<string[] | undefined>(undefined);
  const [working, setWorking] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const editable = canManage(user?.roles);

  if (flagRow === undefined) return <p className="pf-muted">Loading service control…</p>;
  if (flagRow === null) return <p className="pf-muted">The requested service control is unavailable.</p>;

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
        {editable ? (
          <label className="pf-field pf-field-wide">
            <span className="pf-label">Tenant override (empty = global rollout)</span>
            <select
              className="pf-input"
              size={4}
              multiple
              value={tenantOverride ?? flagRow.tenantIds ?? []}
              onChange={(event) =>
                setTenantOverride(Array.from(event.target.selectedOptions).map((option) => option.value))
              }
            >
              {(tenants ?? []).map((tenant) => (
                <option key={tenant._id} value={tenant._id}>
                  {tenant.name}
                </option>
              ))}
            </select>
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
