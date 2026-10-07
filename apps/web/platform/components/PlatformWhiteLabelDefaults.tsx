"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { platformWhiteLabel } from "@/shared/convex/platformWhiteLabel";
import { canManagePlatformWhiteLabel } from "@/platform/permissions";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

export function PlatformWhiteLabelDefaults() {
  const { user } = useUserProfile();
  const roleSlugs = user?.roles.map(role => role.slug);
  const canManage = canManagePlatformWhiteLabel(roleSlugs);
  const defaults = useQuery(platformWhiteLabel.get, canManage ? {} : "skip");
  const saveDefaults = useMutation(platformWhiteLabel.save);
  const resetDefaults = useMutation(platformWhiteLabel.reset);
  const [supportEmailDraft, setSupportEmailDraft] = useState<string | null>(null);
  const [supportPhoneDraft, setSupportPhoneDraft] = useState<string | null>(null);
  const [brandColorDraft, setBrandColorDraft] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supportEmail = supportEmailDraft ?? defaults?.supportEmail ?? "";
  const supportPhone = supportPhoneDraft ?? defaults?.supportPhone ?? "";
  const brandColor = brandColorDraft ?? defaults?.brandColor ?? "#FA8200";

  if (!canManage) return <main className="workspace-page"><EmptyState title="Super-admin access required" body="White-label defaults can only be viewed and managed by platform super-admins." /></main>;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError(""); setMessage("");
    try {
      await saveDefaults({ supportEmail, supportPhone, brandColor });
      setMessage("White-label defaults saved. Tenant-specific branding overrides are unchanged.");
    } catch (caught) {
      setError(userFacingMessage(caught, "White-label defaults could not be saved."));
    } finally { setBusy(false); }
  }

  async function reset() {
    if (!window.confirm("Reset platform white-label defaults? Tenant-specific branding overrides will remain unchanged.")) return;
    setBusy(true); setError(""); setMessage("");
    try {
      await resetDefaults({});
      setSupportEmailDraft(null); setSupportPhoneDraft(null); setBrandColorDraft(null);
      setMessage("Platform defaults reset to the built-in values.");
    } catch (caught) {
      setError(userFacingMessage(caught, "White-label defaults could not be reset."));
    } finally { setBusy(false); }
  }

  return (
    <main className="workspace-page">
      <header className="page-heading"><div><p className="eyebrow">Platform settings</p><h1 className="page-title">White-label defaults</h1><p className="page-subtitle">Set inherited branding and support contact defaults for tenant workspaces.</p></div><StatusPill tone={defaults?.configured ? "success" : "neutral"}>{defaults?.configured ? "Customized" : "Built-in defaults"}</StatusPill></header>
      <p className="pf-hint">Defaults apply when a tenant has no value for that branding field. Existing tenant-specific values are preserved. Support email and phone are defaults only; they do not configure a mail or SMS provider.</p>
      {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Inherited tenant branding</p><h2>Default values</h2></div></div>
        {defaults === undefined ? <p className="pf-muted">Loading white-label defaults…</p> : (
          <form onSubmit={event => void submit(event)} className="form-grid">
            <label className="pf-field"><span className="pf-label">Default support email</span><input className="pf-input" type="email" maxLength={160} value={supportEmail} onChange={event => setSupportEmailDraft(event.target.value)} /></label>
            <label className="pf-field"><span className="pf-label">Default support phone</span><input className="pf-input" maxLength={20} value={supportPhone} onChange={event => setSupportPhoneDraft(event.target.value)} /></label>
            <label className="pf-field"><span className="pf-label">Default brand color</span><div style={{ display: "flex", gap: 8 }}><input aria-label="Choose default brand color" type="color" value={/^#[0-9A-Fa-f]{6}$/.test(brandColor) ? brandColor : "#FA8200"} onChange={event => setBrandColorDraft(event.target.value.toUpperCase())} /><input className="pf-input" required pattern="#[0-9A-Fa-f]{6}" maxLength={7} value={brandColor} onChange={event => setBrandColorDraft(event.target.value)} /></div></label>
            <div className="modal-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "Saving…" : "Save defaults"}</button><button className="secondary-button" type="button" onClick={() => void reset()} disabled={busy}>Reset built-in defaults</button></div>
          </form>
        )}
      </section>
    </main>
  );
}
