"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { platformVoucherPackages, type PlatformVoucherPackage, type PlatformVoucherPackageFields, type PlatformVoucherPackageType } from "@/shared/convex/platformVoucherPackages";
import { canManagePlatformInfrastructure } from "@/platform/permissions";
import { userFacingMessage } from "@/shared/lib/user-facing-error";

type Draft = Omit<PlatformVoucherPackageFields, "durationHours" | "priceEach" | "dataQuotaMb" | "downloadMbps" | "uploadMbps" | "deviceLimit"> & {
  durationHours: string; priceEach: string; dataQuotaMb: string; downloadMbps: string; uploadMbps: string; deviceLimit: string;
};
const emptyDraft = (): Draft => ({ code: "", name: "", description: "", packageType: "day", durationHours: "24", currency: "KES", priceEach: "", dataQuotaMb: "", downloadMbps: "", uploadMbps: "", deviceLimit: "1" });
const optionalNumber = (value: string) => value.trim() ? Number(value) : null;

export function PlatformVoucherPackages() {
  const { user } = useUserProfile();
  const canManage = canManagePlatformInfrastructure(user?.roles.map((role) => role.slug));
  const [cursor, setCursor] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [editing, setEditing] = useState<PlatformVoucherPackage | null | false>(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const page = useQuery(platformVoucherPackages.list, { paginationOpts: { numItems: 25, cursor }, includeArchived, includeDeleted });
  const create = useMutation(platformVoucherPackages.create);
  const update = useMutation(platformVoucherPackages.update);
  const setStatus = useMutation(platformVoucherPackages.setStatus);
  const remove = useMutation(platformVoucherPackages.remove);
  const restore = useMutation(platformVoucherPackages.restore);

  function value<K extends keyof Draft>(key: K, next: Draft[K]) { setDraft((current) => ({ ...current, [key]: next })); }
  function startCreate() { setEditing(null); setDraft(emptyDraft()); setMessage(""); setError(""); }
  function startEdit(item: PlatformVoucherPackage) {
    setEditing(item);
    setDraft({ code: item.code, name: item.name, description: item.description, packageType: item.packageType, durationHours: String(item.durationHours), currency: item.currency, priceEach: String(item.priceEach), dataQuotaMb: item.dataQuotaMb === undefined ? "" : String(item.dataQuotaMb), downloadMbps: item.downloadMbps === undefined ? "" : String(item.downloadMbps), uploadMbps: item.uploadMbps === undefined ? "" : String(item.uploadMbps), deviceLimit: String(item.deviceLimit) });
    setMessage(""); setError("");
  }
  function fields(): PlatformVoucherPackageFields {
    return { code: draft.code, name: draft.name, description: draft.description, packageType: draft.packageType, durationHours: Number(draft.durationHours), currency: draft.currency.toUpperCase(), priceEach: Number(draft.priceEach), dataQuotaMb: optionalNumber(draft.dataQuotaMb), downloadMbps: optionalNumber(draft.downloadMbps), uploadMbps: optionalNumber(draft.uploadMbps), deviceLimit: Number(draft.deviceLimit) };
  }
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError(""); setMessage("");
    try {
      if (editing) {
        await update({ packageId: editing._id, expectedRevision: editing.revision, fields: fields() });
        setMessage("Voucher package updated.");
      } else {
        await create({ fields: fields() });
        setMessage("Voucher package created.");
      }
      setEditing(false); setDraft(emptyDraft());
    } catch (cause) { setError(userFacingMessage(cause, "The voucher package could not be saved.")); }
    finally { setWorking(false); }
  }
  async function run(action: () => Promise<unknown>, success: string) {
    setWorking(true); setError(""); setMessage("");
    try { await action(); setMessage(success); }
    catch (cause) { setError(userFacingMessage(cause, "The voucher package could not be updated.")); }
    finally { setWorking(false); }
  }

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform vouchers</p><h1 className="page-title">Voucher package templates</h1><p className="page-subtitle">Manage reusable voucher offer definitions across markets.</p></div>{canManage ? <button className="primary-button" type="button" onClick={startCreate}>New package</button> : null}</header>
    <p className="pf-hint">These templates describe package offers. They do not create voucher codes, charge customers, or push a network policy.</p>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
    <section className="pf-panel"><div className="section-heading"><div><p className="eyebrow">Offer catalogue</p><h2>Reusable packages</h2></div><span className="section-count">{page?.items.length ?? 0} shown</span></div>
      <div className="tab-row" aria-label="Package visibility"><button className={includeArchived ? "tab-button active" : "tab-button"} type="button" aria-pressed={includeArchived} onClick={() => { setIncludeArchived((old) => !old); setCursor(null); }}>Include archived</button><button className={includeDeleted ? "tab-button active" : "tab-button"} type="button" aria-pressed={includeDeleted} onClick={() => { setIncludeDeleted((old) => !old); setCursor(null); }}>Include deleted</button></div>
      {page === undefined ? <p className="pf-muted">Loading voucher packages…</p> : page.items.length === 0 ? <EmptyState title="No voucher packages" body="Create a reusable offer template for platform operators." /> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Package</th><th>Type</th><th>Validity</th><th>Data</th><th>Speed</th><th>Price</th><th>Status</th><th>Actions</th></tr></thead><tbody>{page.items.map((item) => <tr key={item._id}>
        <td><strong>{item.name}</strong><small className="table-subtext">{item.code}{item.deletedAt ? " · deleted" : ""}</small></td><td>{item.packageType.replace("_", " ")}</td><td>{item.durationHours} hours</td><td>{item.dataQuotaMb == null ? "Unlimited" : `${item.dataQuotaMb.toLocaleString()} MB`}</td><td>{item.downloadMbps == null ? "—" : `${item.downloadMbps}/${item.uploadMbps} Mbps`}</td><td>{item.currency} {item.priceEach.toLocaleString(undefined, { maximumFractionDigits: 2 })}</td><td><StatusPill tone={item.deletedAt ? "danger" : item.status === "active" ? "success" : "neutral"}>{item.deletedAt ? "Deleted" : item.status}</StatusPill></td><td><div className="cell-actions">{canManage && !item.deletedAt ? <><button className="secondary-button" type="button" disabled={working} onClick={() => startEdit(item)}>Edit</button><button className="secondary-button" type="button" disabled={working} onClick={() => void run(() => setStatus({ packageId: item._id, status: item.status === "active" ? "archived" : "active" }), item.status === "active" ? "Package archived." : "Package reactivated.")}>{item.status === "active" ? "Archive" : "Reactivate"}</button><button className="secondary-button danger" type="button" disabled={working} onClick={() => { const reason = window.prompt("Reason for deleting this package"); if (reason?.trim()) void run(() => remove({ packageId: item._id, reason }), "Package deleted and retained for audit history."); }}>Delete</button></> : canManage && item.deletedAt ? <button className="secondary-button" type="button" disabled={working} onClick={() => void run(() => restore({ packageId: item._id }), "Package restored as active.")}>Restore</button> : null}</div></td>
      </tr>)}</tbody></table></div>}
      {page ? <div className="modal-actions"><span className="pf-muted">{page.isDone ? "End of package catalogue" : "More packages available"}</span><button className="secondary-button" type="button" disabled={page.isDone} onClick={() => setCursor(page.continueCursor)}>Next page</button></div> : null}
    </section>
    {editing !== false ? <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label={editing ? "Edit voucher package" : "Create voucher package"}><form className="profile-modal-dialog" onSubmit={(event) => void save(event)}><header className="profile-modal-header"><div><p className="eyebrow">Voucher package</p><h2 className="page-title">{editing ? `Edit ${editing.name}` : "Create a package"}</h2></div><button className="profile-modal-close" type="button" onClick={() => setEditing(false)} aria-label="Close">×</button></header><div className="modal-body"><div className="form-grid">
      <Field label="Package code"><input className="pf-input" required minLength={2} maxLength={40} pattern="[a-z][a-z0-9-]{1,39}" value={draft.code} onChange={(event) => value("code", event.target.value)} /></Field>
      <Field label="Package name"><input className="pf-input" required minLength={2} maxLength={80} value={draft.name} onChange={(event) => value("name", event.target.value)} /></Field>
      <Field label="Type"><select className="pf-input" value={draft.packageType} onChange={(event) => value("packageType", event.target.value as PlatformVoucherPackageType)}><option value="half_day">Half day</option><option value="day">Day</option><option value="week">Week</option><option value="month">Month</option><option value="specialty">Specialty</option></select></Field>
      <Field label="Validity (hours)"><input className="pf-input" type="number" required min="0.01" max="8760" step="0.01" value={draft.durationHours} onChange={(event) => value("durationHours", event.target.value)} /></Field>
      <Field label="Currency"><input className="pf-input" required minLength={3} maxLength={3} pattern="[A-Za-z]{3}" value={draft.currency} onChange={(event) => value("currency", event.target.value)} /></Field>
      <Field label="Price per voucher"><input className="pf-input" type="number" required min="0" max="100000000" step="0.01" value={draft.priceEach} onChange={(event) => value("priceEach", event.target.value)} /></Field>
      <Field label="Data quota (MB)"><input className="pf-input" type="number" min="0.01" max="1000000000" step="0.01" value={draft.dataQuotaMb} onChange={(event) => value("dataQuotaMb", event.target.value)} /></Field>
      <Field label="Download speed (Mbps)"><input className="pf-input" type="number" min="0.01" max="10000" step="0.01" value={draft.downloadMbps} onChange={(event) => value("downloadMbps", event.target.value)} /></Field>
      <Field label="Upload speed (Mbps)"><input className="pf-input" type="number" min="0.01" max="10000" step="0.01" value={draft.uploadMbps} onChange={(event) => value("uploadMbps", event.target.value)} /></Field>
      <Field label="Device limit"><input className="pf-input" type="number" required min="1" max="1000" value={draft.deviceLimit} onChange={(event) => value("deviceLimit", event.target.value)} /></Field>
      <Field label="Description" wide><textarea className="pf-input" rows={2} maxLength={500} value={draft.description} onChange={(event) => value("description", event.target.value)} /></Field>
    </div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" disabled={working}>{working ? "Saving…" : editing ? "Save changes" : "Create package"}</button></div></div></form></div> : null}
  </main>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`pf-field${wide ? " pf-field-wide" : ""}`}><span className="pf-label">{label}</span>{children}</label>; }
