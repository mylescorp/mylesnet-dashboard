"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePaginatedQuery } from "convex/react";
import { Archive, KeyRound, Power, Plus, RefreshCw } from "lucide-react";
import { Button, ConfirmDialog, EmptyState, ErrorState, Field, SkeletonTable, StatusPill, TextInput } from "@mylesnet/ui";
import { useMutation } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import { platformPaymentGateways, type PaymentGatewayConfig } from "@/shared/convex/platformPaymentGateways";
import { tenantControl } from "@/shared/convex/tenantControl";

const MANAGER_ROLES = ["platform_super_admin", "platform_owner"];
const FINANCE_ROLES = ["platform_finance", "finance_manager"];

type Credentials = { consumerKey: string; consumerSecret: string; passkey: string };

export function PlatformPaymentGateways() {
  const { user, isLoading: profileLoading } = useUserProfile();
  const roleSlugs = user?.roles.map((role) => role.slug) ?? [];
  const canManage = roleSlugs.some((slug) => MANAGER_ROLES.includes(slug));
  const canEditPublicFields = canManage || roleSlugs.some((slug) => FINANCE_ROLES.includes(slug));
  const [viewLogged, setViewLogged] = useState(false);
  const [viewError, setViewError] = useState<string | null>(null);
  const viewRecordStarted = useRef(false);
  const { results, status, loadMore } = usePaginatedQuery(
    platformPaymentGateways.list,
    canManage && viewLogged ? { includeArchived: true } : "skip",
    { initialNumItems: 25 },
  );
  const { results: tenants, status: tenantStatus, loadMore: loadMoreTenants } = usePaginatedQuery(
    tenantControl.listPlatformTenantTargetsPage,
    canEditPublicFields ? {} : "skip",
    { initialNumItems: 50 },
  );
  const createConfig = useMutation(platformPaymentGateways.create);
  const recordSettingsView = useMutation(platformPaymentGateways.recordSettingsView);
  const updatePublicFields = useMutation(platformPaymentGateways.updatePublicFields);
  const archiveConfig = useMutation(platformPaymentGateways.archive);
  const restoreConfig = useMutation(platformPaymentGateways.restore);

  const [tenantId, setTenantId] = useState("");
  const [environment, setEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [shortCode, setShortCode] = useState("");
  const [editingTenantId, setEditingTenantId] = useState("");
  const [editingEnvironment, setEditingEnvironment] = useState<"sandbox" | "production">("sandbox");
  const [editingShortCode, setEditingShortCode] = useState("");
  const [credentialsTarget, setCredentialsTarget] = useState<PaymentGatewayConfig | null>(null);
  const [credentials, setCredentials] = useState<Credentials>({ consumerKey: "", consumerSecret: "", passkey: "" });
  const [credentialOperationId, setCredentialOperationId] = useState<string | null>(null);
  const [archiveTarget, setArchiveTarget] = useState<PaymentGatewayConfig | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const selectedTenant = tenants.find((tenant) => tenant._id === editingTenantId);

  const logSettingsView = useCallback(async () => {
    setViewError(null);
    try {
      await recordSettingsView({});
      setViewLogged(true);
    } catch (caught) {
      setViewError(userFacingMessage(caught, "Payment settings could not be opened."));
    }
  }, [recordSettingsView]);

  useEffect(() => {
    if (!canEditPublicFields || viewRecordStarted.current) return;
    viewRecordStarted.current = true;
    void logSettingsView();
  }, [canEditPublicFields, logSettingsView]);

  async function savePublicFields() {
    if (!editingTenantId) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await updatePublicFields({ tenantId: editingTenantId, environment: editingEnvironment, shortCode: editingShortCode });
      setNotice("Public payment settings saved.");
    } catch (caught) {
      setError(userFacingMessage(caught, "Payment settings could not be saved."));
    } finally { setBusy(false); }
  }

  async function createGateway() {
    setBusy(true); setError(null); setNotice(null);
    try {
      const id = await createConfig({ tenantId, environment, shortCode });
      const tenant = tenants.find((item) => item._id === tenantId);
      setNotice("Gateway settings created. Add credentials to enable payments.");
      setEditingTenantId(tenantId); setEditingEnvironment(environment); setEditingShortCode(shortCode);
      setCredentialsTarget({ _id: id, tenantId, tenantName: tenant?.name ?? null, provider: "daraja", environment, shortCode, enabled: false, credentialsConfigured: false, rotationPending: false, createdAt: Date.now(), updatedAt: Date.now(), deletedAt: null });
      setTenantId(""); setShortCode("");
    } catch (caught) {
      setError(userFacingMessage(caught, "Gateway settings could not be created."));
    } finally { setBusy(false); }
  }

  async function submitCredentials() {
    if (!credentialsTarget) return;
    setBusy(true); setError(null); setNotice(null);
    let operationId = credentialOperationId;
    try {
      if (!operationId) {
        operationId = crypto.randomUUID();
        setCredentialOperationId(operationId);
      }
    }
    catch { setBusy(false); setError("Credential updates are unavailable in this browser. Please use a current browser."); return; }
    try {
      const csrfResponse = await fetch("/api/auth/csrf", { method: "GET", credentials: "same-origin", cache: "no-store" });
      const csrfPayload = await csrfResponse.json() as { csrfToken?: string };
      if (!csrfResponse.ok || !csrfPayload.csrfToken) throw new Error("Unable to prepare a secure credential update.");
      const response = await fetch(`/api/platform/payment-gateways/${encodeURIComponent(credentialsTarget._id)}/credentials`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json", "X-CSRF-Token": csrfPayload.csrfToken, "Idempotency-Key": operationId },
        body: JSON.stringify(credentials),
      });
      const payload = await response.json() as { success?: boolean; message?: string };
      if (!response.ok || !payload.success) {
        if (response.status !== 503) setCredentialOperationId(null);
        throw new Error(payload.message || "Credentials could not be saved.");
      }
      setCredentials({ consumerKey: "", consumerSecret: "", passkey: "" });
      setCredentialsTarget(null); setCredentialOperationId(null); setNotice("Credentials saved. They cannot be viewed here.");
    } catch (caught) {
      setError(userFacingMessage(caught, "Credentials could not be saved. Check the fields and try again."));
    } finally { setBusy(false); }
  }

  async function confirmArchive() {
    if (!archiveTarget) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      if (archiveTarget.deletedAt === null) await archiveConfig({ configId: archiveTarget._id });
      else await restoreConfig({ configId: archiveTarget._id });
      setNotice(archiveTarget.deletedAt === null ? "Gateway settings archived and disabled." : "Gateway settings restored in the disabled state.");
      setArchiveTarget(null);
    } catch (caught) { setError(userFacingMessage(caught, "Gateway settings could not be updated.")); }
    finally { setBusy(false); }
  }

  async function setGatewayEnabled(row: PaymentGatewayConfig, enabled: boolean) {
    setBusy(true); setError(null); setNotice(null);
    try {
      await updatePublicFields({ tenantId: row.tenantId, enabled });
      setNotice(enabled ? "Payment gateway enabled." : "Payment gateway disabled.");
    } catch (caught) {
      setError(userFacingMessage(caught, "Gateway status could not be changed."));
    } finally { setBusy(false); }
  }

  if (profileLoading) return <div className="workspace-page"><SkeletonTable rows={4} cols={4} /></div>;
  if (!canManage && !canEditPublicFields) return <div className="workspace-page"><EmptyState title="Access unavailable" body="You do not have permission to view or edit payment settings." /></div>;
  if (canEditPublicFields && !viewLogged) {
    return <main className="workspace-page" aria-busy={viewError === null}>
      {viewError ? <div role="alert"><ErrorState title="Payment settings could not be opened" body={viewError} retry={() => { viewRecordStarted.current = true; void logSettingsView(); }} /></div> : <SkeletonTable rows={4} cols={4} />}
    </main>;
  }

  return (
    <main className="workspace-page">
      <header className="page-heading"><div><p className="eyebrow">Platform settings</p><h1 className="page-title">Payment gateways</h1><p className="page-subtitle">Tenant-owned Daraja credentials are stored securely and can never be viewed here.</p></div></header>
      {error ? <div role="alert"><ErrorState title="Payment settings could not be updated" body={error} retry={() => setError(null)} /></div> : null}
      {notice ? <p className="platform-notice" role="status">{notice}</p> : null}

      {canManage ? <>
        <section className="pf-panel" aria-labelledby="gateway-create-heading">
          <div className="section-heading"><div><p className="eyebrow">Workspace configuration</p><h2 id="gateway-create-heading">Add Daraja settings</h2></div></div>
          <div className="form-grid">
            <Field label="Workspace" required><select className="pf-input" value={tenantId} onChange={(event) => setTenantId(event.target.value)}><option value="">Choose a workspace</option>{tenants.map((tenant) => <option key={tenant._id} value={tenant._id}>{tenant.name}</option>)}</select></Field>
            <Field label="Environment" required><select className="pf-input" value={environment} onChange={(event) => setEnvironment(event.target.value as "sandbox" | "production")}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></Field>
            <Field label="Business short code" hint="Safaricom-issued 5 or 6 digit shortcode." required><TextInput inputMode="numeric" pattern="[0-9]{5,6}" maxLength={6} value={shortCode} onChange={(event) => setShortCode(event.target.value)} /></Field>
          </div>
          <div className="modal-actions"><Button disabled={busy || !tenantId || !shortCode} onClick={createGateway}><Plus size={16} aria-hidden="true" />Create gateway</Button></div>
          {tenantStatus === "CanLoadMore" || tenantStatus === "LoadingMore" ? <Button variant="secondary" disabled={tenantStatus === "LoadingMore"} onClick={() => loadMoreTenants(50)}>Load more workspaces</Button> : null}
        </section>
        <section className="pf-panel" aria-labelledby="gateway-directory-heading">
          <div className="section-heading"><div><p className="eyebrow">Credentials</p><h2 id="gateway-directory-heading">Configured workspaces</h2></div></div>
          {status === "LoadingFirstPage" ? <SkeletonTable rows={5} cols={5} /> : results.length === 0 ? <EmptyState title="No gateway settings yet" body="Add a workspace configuration above to begin a secure Daraja setup." /> : <div className="table-scroll"><table className="data-table"><thead><tr><th>Workspace</th><th>Environment</th><th>Short code</th><th>Credentials</th><th>Status</th><th>Actions</th></tr></thead><tbody>{results.map((row) => <tr key={row._id}><td>{row.tenantName ?? "Unavailable workspace"}</td><td>{row.environment === "production" ? "Production" : "Sandbox"}</td><td>{row.shortCode}</td><td>{row.credentialsConfigured ? "Configured · write-only" : "Not configured"}{row.rotationPending ? " · Update in progress" : ""}</td><td><StatusPill tone={row.deletedAt !== null ? "neutral" : row.enabled ? "success" : "warning"}>{row.deletedAt !== null ? "Archived" : row.enabled ? "Enabled" : "Disabled"}</StatusPill></td><td><div className="table-actions">{row.deletedAt === null ? <><Button variant="secondary" disabled={busy || row.rotationPending} onClick={() => { setCredentialsTarget(row); setCredentialOperationId(null); setCredentials({ consumerKey: "", consumerSecret: "", passkey: "" }); }}><KeyRound size={15} aria-hidden="true" />{row.credentialsConfigured ? "Rotate credentials" : "Add credentials"}</Button>{row.credentialsConfigured ? <Button variant={row.enabled ? "danger" : "secondary"} disabled={busy || row.rotationPending} onClick={() => void setGatewayEnabled(row, !row.enabled)}><Power size={15} aria-hidden="true" />{row.enabled ? "Disable" : "Enable"}</Button> : null}<Button variant="secondary" disabled={busy} onClick={() => setArchiveTarget(row)}><Archive size={15} aria-hidden="true" />Archive</Button></> : <Button variant="secondary" disabled={busy} onClick={() => setArchiveTarget(row)}><RefreshCw size={15} aria-hidden="true" />Restore</Button>}</div></td></tr>)}</tbody></table></div>}
          {status === "CanLoadMore" || status === "LoadingMore" ? <Button variant="secondary" disabled={status === "LoadingMore"} onClick={() => loadMore(25)}>Load more gateway settings</Button> : null}
        </section>
      </> : <section className="pf-panel" aria-labelledby="finance-edit-heading">
        <p className="eyebrow">Finance access</p><h2 id="finance-edit-heading">Edit public payment settings</h2><p className="page-subtitle">This form does not read or reveal gateway configuration or credentials. Updates are saved only when a gateway already exists for the selected workspace.</p>
        <div className="form-grid"><Field label="Workspace" required><select className="pf-input" value={editingTenantId} onChange={(event) => { const id = event.target.value; setEditingTenantId(id); const row = results.find((item) => item.tenantId === id); setEditingEnvironment(row?.environment ?? "sandbox"); setEditingShortCode(row?.shortCode ?? ""); }}><option value="">Choose a workspace</option>{tenants.map((tenant) => <option key={tenant._id} value={tenant._id}>{tenant.name}</option>)}</select></Field><Field label="Environment"><select className="pf-input" value={editingEnvironment} onChange={(event) => setEditingEnvironment(event.target.value as "sandbox" | "production")}><option value="sandbox">Sandbox</option><option value="production">Production</option></select></Field><Field label="Business short code"><TextInput inputMode="numeric" pattern="[0-9]{5,6}" maxLength={6} value={editingShortCode} onChange={(event) => setEditingShortCode(event.target.value)} /></Field></div>
        <div className="modal-actions"><Button disabled={busy || !editingTenantId || !editingShortCode} onClick={savePublicFields}>Save public settings</Button></div>
        {tenantStatus === "CanLoadMore" || tenantStatus === "LoadingMore" ? <Button variant="secondary" disabled={tenantStatus === "LoadingMore"} onClick={() => loadMoreTenants(50)}>{tenantStatus === "LoadingMore" ? "Loading workspaces…" : "Load more workspaces"}</Button> : null}
        {selectedTenant ? <p className="pf-hint">Updates are applied only if this workspace already has gateway settings. An unavailable result does not reveal whether a configuration exists.</p> : null}
      </section>}

      {credentialsTarget ? <div className="profile-modal-overlay" role="presentation"><section className="profile-modal-dialog" role="dialog" aria-modal="true" aria-labelledby="credential-dialog-title"><header className="profile-modal-header"><div><p className="eyebrow">{credentialsTarget.tenantName ?? "Workspace"}</p><h2 id="credential-dialog-title" className="page-title">{credentialsTarget.credentialsConfigured ? "Rotate Daraja credentials" : "Add Daraja credentials"}</h2><p className="page-subtitle">Credential values are sent directly to encrypted secret storage. They are not returned after saving.</p></div><button type="button" className="profile-modal-close" disabled={busy} onClick={() => { setCredentialsTarget(null); setCredentialOperationId(null); }} aria-label="Close">×</button></header><div className="form-grid"><Field label="Consumer key" required><TextInput autoComplete="off" value={credentials.consumerKey} onChange={(event) => setCredentials({ ...credentials, consumerKey: event.target.value })} /></Field><Field label="Consumer secret" required><TextInput type="password" autoComplete="new-password" value={credentials.consumerSecret} onChange={(event) => setCredentials({ ...credentials, consumerSecret: event.target.value })} /></Field><Field label="STK passkey" required><TextInput type="password" autoComplete="new-password" value={credentials.passkey} onChange={(event) => setCredentials({ ...credentials, passkey: event.target.value })} /></Field></div><div className="modal-actions"><Button variant="secondary" disabled={busy} onClick={() => { setCredentialsTarget(null); setCredentialOperationId(null); }}>Cancel</Button><Button disabled={busy || !credentials.consumerKey || !credentials.consumerSecret || !credentials.passkey} onClick={submitCredentials}>{busy ? "Saving…" : "Save credentials"}</Button></div></section></div> : null}
      <ConfirmDialog open={archiveTarget !== null} onClose={() => setArchiveTarget(null)} onConfirm={confirmArchive} title={archiveTarget?.deletedAt === null ? "Archive gateway settings?" : "Restore gateway settings?"} description={archiveTarget?.deletedAt === null ? "This disables the gateway and archives its metadata. The stored credentials remain protected." : "The gateway will be restored in the disabled state."} confirmLabel={archiveTarget?.deletedAt === null ? "Archive settings" : "Restore settings"} loading={busy} danger={archiveTarget?.deletedAt === null} />
    </main>
  );
}
