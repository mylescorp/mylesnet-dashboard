"use client";

import { useState, type FormEvent } from "react";
import { usePaginatedQuery } from "convex/react";
import { useMutation } from "@/app/lib/convex";
import { platformApiKeys } from "@/shared/convex/platformApiKeys";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

const options = ["organizations:read"] as const;
const date = (value: number | null) => value === null ? "Never" : new Date(value).toLocaleString();
const describeScope = (scope: string) => scope === "organizations:read" ? "Organization records" : "Other access";

export function PlatformApiKeys({ canManage }: { canManage: boolean }) {
  const { results, status, loadMore } = usePaginatedQuery(platformApiKeys.list, {}, { initialNumItems: 20 });
  const createKey = useMutation(platformApiKeys.create);
  const revokeKey = useMutation(platformApiKeys.revoke);
  const updateKey = useMutation(platformApiKeys.update);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>(["organizations:read"]);
  const [expiresAt, setExpiresAt] = useState("");
  const [newToken, setNewToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError(null); setNewToken(null);
    try {
      const result = await createKey({ name, scopes, ...(expiresAt ? { expiresAt: new Date(expiresAt).getTime() } : {}) });
      setNewToken(result.token); setName(""); setExpiresAt("");
    } catch (caught) { setError(userFacingMessage(caught, "The API key could not be created.")); }
    finally { setBusy(false); }
  }

  async function revoke(id: string) {
    if (!window.confirm("Revoke this API key? This takes effect immediately and cannot be undone.")) return;
    setBusy(true); setError(null);
    try { await revokeKey({ keyId: id }); }
    catch (caught) { setError(userFacingMessage(caught, "The API key could not be revoked.")); }
    finally { setBusy(false); }
  }

  async function editKey(key: (typeof results)[number]) {
    const nextName = window.prompt("API key name", key.name);
    if (nextName === null) return;
    const nextScopes = window.prompt(`Comma-separated scopes (${options.join(", ")})`, key.scopes.join(", "));
    if (nextScopes === null) return;
    const parsed = nextScopes.split(",").map(value => value.trim()).filter(Boolean);
    if (parsed.some(value => !options.includes(value as (typeof options)[number])) || parsed.length === 0) { setError("Choose one or more supported read scopes."); return; }
    setBusy(true); setError(null);
    try { await updateKey({ keyId: key._id, name: nextName, scopes: parsed }); }
    catch (caught) { setError(userFacingMessage(caught, "The API key could not be updated.")); }
    finally { setBusy(false); }
  }

  return <div className="pf-stack">
    <header className="page-header"><div><p className="eyebrow">Platform access</p><h1>Platform API keys</h1><p className="page-subtitle">Create credentials for approved organization data access. A new token is shown only once.</p></div></header>
    {error && <p role="alert" className="pf-error">{error}</p>}
    {newToken && <section className="pf-panel" aria-live="polite"><h2>Copy this token now</h2><p className="pf-hint">It will not be shown again. Store it in your secrets manager.</p><code>{newToken}</code><button className="secondary-button" type="button" onClick={() => navigator.clipboard.writeText(newToken)}>Copy token</button><button className="secondary-button" type="button" onClick={() => setNewToken(null)}>Dismiss</button></section>}
    {canManage && <form className="pf-panel pf-stack" onSubmit={submit}><h2>Issue a key</h2><label className="pf-field"><span className="pf-label">Name</span><input required maxLength={80} className="pf-input" value={name} onChange={e => setName(e.target.value)} /></label><fieldset><legend>Access</legend><label className="pf-field"><input type="checkbox" checked={scopes.includes("organizations:read")} onChange={e => setScopes(e.target.checked ? ["organizations:read"] : [])} /> Read organization records</label></fieldset><label className="pf-field"><span className="pf-label">Expiry (optional, max 365 days)</span><input type="datetime-local" className="pf-input" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} /></label><button className="primary-button" disabled={busy || scopes.length === 0}>Create API key</button></form>}
    <section className="pf-panel"><h2>Issued keys</h2>{status === "LoadingFirstPage" ? <p>Loading keys…</p> : results.length === 0 ? <p>No platform API keys have been issued.</p> : <div className="table-wrap"><table className="data-table"><thead><tr><th>Name</th><th>Prefix</th><th>Access</th><th>Created</th><th>Expires</th><th>Status</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{results.map(key => <tr key={key._id}><td>{key.name}</td><td><code>{key.prefix}…</code></td><td>{key.scopes.map(describeScope).join(", ")}</td><td>{date(key.createdAt)}</td><td>{date(key.expiresAt)}</td><td>{key.revokedAt ? `Revoked ${date(key.revokedAt)}` : "Not revoked"}</td>{canManage && <td>{!key.revokedAt && <><button className="secondary-button" disabled={busy} onClick={() => void editKey(key)}>Edit</button> <button className="secondary-button" disabled={busy} onClick={() => void revoke(key._id)}>Revoke</button></>}</td>}</tr>)}</tbody></table></div>}{status === "CanLoadMore" && <button className="secondary-button" onClick={() => loadMore(20)}>Load more</button>}</section>
  </div>;
}
