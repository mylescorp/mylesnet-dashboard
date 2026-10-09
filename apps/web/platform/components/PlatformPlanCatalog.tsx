"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { platformPlans } from "@/shared/convex/platformPlans";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { canManagePlatformPlans } from "@/platform/permissions";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

const priceLabel = (minor: number) => `KES ${(minor / 100).toLocaleString("en-KE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function PlatformPlanCatalog() {
  const { user } = useUserProfile();
  const plans = useQuery(platformPlans.list, {});
  const createPlan = useMutation(platformPlans.create);
  const updatePlan = useMutation(platformPlans.update);
  const changeStatus = useMutation(platformPlans.setStatus);
  const removePlan = useMutation(platformPlans.remove);
  const canManage = canManagePlatformPlans(user?.roles.map(role => role.slug));
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const numericPrice = Number(price);
    if (!Number.isFinite(numericPrice) || numericPrice < 0) {
      setMessage("Enter a non-negative monthly price in KES.");
      return;
    }
    setBusy(true);
    try {
      const monthlyPriceMinor = Math.round(numericPrice * 100);
      if (editingId) {
        await updatePlan({ code, name, monthlyPriceMinor });
        setMessage("Plan updated. Existing active entitlements use the new contracted price.");
      } else {
        await createPlan({ code: code.trim().toLowerCase(), name, monthlyPriceMinor });
        setMessage("Plan created.");
      }
      setEditingId(null);
      setCode("");
      setName("");
      setPrice("");
    } catch (error) {
      setMessage(userFacingMessage(error, "Plan could not be saved."));
    } finally {
      setBusy(false);
    }
  }

  function edit(plan: NonNullable<typeof plans>[number]) {
    setEditingId(plan.code);
    setCode(plan.code);
    setName(plan.name);
    setPrice((plan.monthlyPriceMinor / 100).toFixed(2));
    setMessage("");
  }

  async function toggleStatus(plan: NonNullable<typeof plans>[number]) {
    const status = plan.status === "active" ? "archived" : "active";
    if (status === "archived" && !window.confirm(`Archive ${plan.name}? Existing active tenant entitlements remain priced at this plan’s monthly price.`)) return;
    setMessage("");
    try {
      await changeStatus({ code: plan.code, status });
      setMessage(status === "archived" ? "Plan archived. Existing entitlements remain priced." : "Plan reactivated.");
    } catch (error) {
      setMessage(userFacingMessage(error, "Plan status could not be changed."));
    }
  }

  async function remove(plan: NonNullable<typeof plans>[number]) {
    if (!window.confirm(`Permanently delete the ${plan.name} plan? Deletion is allowed only when no tenant subscription record refers to it.`)) return;
    setMessage("");
    try {
      await removePlan({ code: plan.code });
      setMessage("Plan deleted.");
    } catch (error) {
      setMessage(userFacingMessage(error, "Plan could not be deleted."));
    }
  }

  return (
    <main className="workspace-page">
      <header className="page-heading"><div><p className="eyebrow">Platform billing</p><h1 className="page-title">Subscription plans</h1><p className="page-subtitle">Manage the global KES monthly-price catalogue used by contracted MRR reporting.</p></div><StatusPill tone="neutral">KES · monthly</StatusPill></header>
      <p className="pf-hint">Changing a plan price changes the contracted MRR calculation for tenants on that plan. This does not create an invoice, charge a tenant, or record cash collection. Archived plans remain priced for existing entitlements. A plan can be deleted only when no tenant subscription refers to it.</p>
      {message ? <p className="platform-claim-message" role="status">{message}</p> : null}
      {canManage ? <form className="pf-panel" onSubmit={event => void save(event)} style={{ display: "grid", gap: 12, gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))", marginBottom: 20 }}>
        <label className="pf-field"><span className="pf-label">Plan code</span><input className="pf-input" required minLength={2} maxLength={40} pattern="[a-z][a-z0-9_-]{1,39}" title="Use lowercase letters, numbers, hyphens, or underscores." value={code} disabled={Boolean(editingId)} onChange={event => setCode(event.target.value)} /></label>
        <label className="pf-field"><span className="pf-label">Plan name</span><input className="pf-input" required maxLength={80} value={name} onChange={event => setName(event.target.value)} /></label>
        <label className="pf-field"><span className="pf-label">Monthly price (KES)</span><input className="pf-input" type="number" required min="0" max="1000000" step="0.01" value={price} onChange={event => setPrice(event.target.value)} /></label>
        <div style={{ display: "flex", alignItems: "end", gap: 8 }}><button className="pf-button" disabled={busy}>{busy ? "Saving…" : editingId ? "Save changes" : "Add plan"}</button>{editingId ? <button type="button" className="secondary-button" onClick={() => { setEditingId(null); setCode(""); setName(""); setPrice(""); }}>Cancel</button> : null}</div>
      </form> : null}
      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Price catalogue</p><h2>Monthly plans</h2></div><span className="section-count">{plans?.length ?? 0} plans</span></div>
        {plans === undefined ? <p className="pf-muted">Loading plan catalogue…</p> : plans.length === 0 ? <EmptyState title="Plan catalogue not initialized" body="Approved baseline plans appear when a platform finance or super-admin operator opens plan management." /> : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Plan</th><th>Code</th><th>Monthly price</th><th>Status</th>{canManage ? <th>Actions</th> : null}</tr></thead><tbody>
            {plans.map(plan => <tr key={plan.code}><td><strong>{plan.name}</strong></td><td><code>{plan.code}</code></td><td>{priceLabel(plan.monthlyPriceMinor)}</td><td><StatusPill tone={plan.status === "active" ? "success" : "neutral"}>{plan.status}</StatusPill></td>{canManage ? <td><div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}><button type="button" className="secondary-button" onClick={() => edit(plan)}>Edit</button><button type="button" className="secondary-button" onClick={() => void toggleStatus(plan)}>{plan.status === "active" ? "Archive" : "Reactivate"}</button><button type="button" className="secondary-button" onClick={() => void remove(plan)}>Delete</button></div></td> : null}</tr>)}
          </tbody></table></div>
        )}
      </section>
    </main>
  );
}
