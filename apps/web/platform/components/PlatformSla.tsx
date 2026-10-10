"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { platformSla, type PlatformSlaPolicy, type SlaCategory } from "@/shared/convex/platformSla";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import { hasAnyRole } from "@/shared/auth/rbac";

const categoryLabel: Record<SlaCategory, string> = { network: "Network", billing: "Billing", account: "Account" };
const canManageSlas = (roles: { slug: string }[] | undefined) => hasAnyRole(roles?.map((role) => role.slug) ?? [], ["platform_super_admin", "platform_owner", "platform_admin"]);

export function PlatformSla() {
  const { user } = useUserProfile();
  const policies = useQuery(platformSla.list, {});
  const create = useMutation(platformSla.create);
  const update = useMutation(platformSla.update);
  const remove = useMutation(platformSla.remove);
  const [category, setCategory] = useState<SlaCategory>("network");
  const [firstResponse, setFirstResponse] = useState("15");
  const [resolution, setResolution] = useState("240");
  const [editing, setEditing] = useState<PlatformSlaPolicy | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const canManage = canManageSlas(user?.roles);
  const existingCategories = new Set(policies?.map(policy => policy.category) ?? []);

  function startEdit(policy: PlatformSlaPolicy) {
    setEditing(policy); setCategory(policy.category); setFirstResponse(String(policy.firstResponseMinutes)); setResolution(String(policy.resolutionMinutes)); setError(""); setMessage("");
  }
  function reset() { setEditing(null); setCategory("network"); setFirstResponse("15"); setResolution("240"); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    const firstResponseMinutes = Number(firstResponse); const resolutionMinutes = Number(resolution);
    try {
      if (editing) await update({ policyId: editing._id, firstResponseMinutes, resolutionMinutes });
      else await create({ category, firstResponseMinutes, resolutionMinutes });
      setMessage(`${categoryLabel[category]} SLA ${editing ? "updated" : "created"}.`); reset();
    } catch (caught) { setError(userFacingMessage(caught, "SLA policy could not be saved.")); }
    finally { setBusy(false); }
  }

  async function deletePolicy(policy: PlatformSlaPolicy) {
    if (!window.confirm(`Delete the ${categoryLabel[policy.category]} SLA policy? New tickets in that category will use the system fallback until a new policy is created.`)) return;
    setBusy(true); setError(""); setMessage("");
    try { await remove({ policyId: policy._id }); setMessage(`${categoryLabel[policy.category]} SLA policy deleted.`); if (editing?._id === policy._id) reset(); }
    catch (caught) { setError(userFacingMessage(caught, "SLA policy could not be deleted.")); }
    finally { setBusy(false); }
  }

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform support</p><h1 className="page-title">SLA configuration</h1><p className="page-subtitle">Set first response and resolution targets by support category. Network issues should receive the fastest targets.</p></div><StatusPill tone="neutral">Minutes</StatusPill></header>
    <p className="pf-hint">Policies are configuration records. Existing tickets keep their stored due times; changes apply to new tickets. Missing categories use the built-in system fallback.</p>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
    {canManage ? <form className="pf-panel" onSubmit={event => void save(event)} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 20 }}>
      <label className="pf-field"><span className="pf-label">Category</span><select className="pf-input" value={category} disabled={Boolean(editing)} onChange={event => setCategory(event.target.value as SlaCategory)}>{(["network", "billing", "account"] as const).map(value => <option key={value} value={value} disabled={!editing && existingCategories.has(value)}>{categoryLabel[value]}{existingCategories.has(value) && !editing ? " (configured)" : ""}</option>)}</select></label>
      <label className="pf-field"><span className="pf-label">First response (minutes)</span><input className="pf-input" type="number" min="1" max="525600" step="1" required value={firstResponse} onChange={event => setFirstResponse(event.target.value)} /></label>
      <label className="pf-field"><span className="pf-label">Resolution (minutes)</span><input className="pf-input" type="number" min="1" max="525600" step="1" required value={resolution} onChange={event => setResolution(event.target.value)} /></label>
      <div style={{ display: "flex", alignItems: "end", gap: 8 }}><button className="pf-button" disabled={busy}>{busy ? "Saving…" : editing ? "Save changes" : "Add policy"}</button>{editing ? <button type="button" className="secondary-button" onClick={reset}>Cancel</button> : null}</div>
    </form> : null}
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Response commitments</p><h2>Category targets</h2></div><span className="section-count">{policies?.length ?? 0} configured</span></div>
      {policies === undefined ? <p className="pf-muted">Loading SLA policies…</p> : policies.length === 0 ? <EmptyState title="No category overrides" body="The support queue is using built-in defaults. Super-admins can configure explicit category targets here." /> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Category</th><th>First response</th><th>Resolution</th>{canManage ? <th>Actions</th> : null}</tr></thead><tbody>{policies.map(policy => <tr key={policy._id}><td><strong>{categoryLabel[policy.category]}</strong></td><td>{formatMinutes(policy.firstResponseMinutes)}</td><td>{formatMinutes(policy.resolutionMinutes)}</td>{canManage ? <td><div className="cell-actions"><button type="button" className="secondary-button" onClick={() => startEdit(policy)}>Edit</button><button type="button" className="secondary-button" disabled={busy} onClick={() => void deletePolicy(policy)}>Delete</button></div></td> : null}</tr>)}</tbody></table></div>}
    </section>
  </main>;
}

function formatMinutes(minutes: number) { const days = Math.floor(minutes / 1440); const hours = Math.floor((minutes % 1440) / 60); const mins = minutes % 60; return [days ? `${days}d` : "", hours ? `${hours}h` : "", mins ? `${mins}m` : ""].filter(Boolean).join(" ") || "0m"; }
