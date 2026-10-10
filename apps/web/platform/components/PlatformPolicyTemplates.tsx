"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { useUserProfile } from "@/shared/components/UserProfileContext";
import { EmptyState, StatusPill } from "@/shared/components/ui";
import { platformPolicyTemplates, type PolicyAccessType, type PolicyFields, type PolicyTemplate, type PolicyTemplateWithCurrent, type PolicyVersion } from "@/shared/convex/platformPolicyTemplates";
import { userFacingMessage } from "@/shared/lib/user-facing-error";
import { canManagePlatformInfrastructure } from "@/platform/permissions";

type Draft = {
  code: string; name: string; description: string; accessType: PolicyAccessType; changeNote: string;
  downloadMbps: string; uploadMbps: string; burstDownloadMbps: string; burstUploadMbps: string; burstThresholdPercent: string; burstWindowSeconds: string;
  concurrentSessions: string; deviceLimit: string; dataQuotaGb: string; timeQuotaHours: string; fairUseAfterGb: string; fairUseDownloadMbps: string; fairUseUploadMbps: string;
  vlanId: string; ipPool: string; staticIpAllowed: boolean; dnsServers: string; scheduleStart: string; scheduleEnd: string;
  idleTimeoutMinutes: string; sessionTimeoutHours: string; firewallProfile: string; serviceEnabled: boolean;
};

const blankDraft = (): Draft => ({ code: "", name: "", description: "", accessType: "both", changeNote: "", downloadMbps: "20", uploadMbps: "5", burstDownloadMbps: "", burstUploadMbps: "", burstThresholdPercent: "", burstWindowSeconds: "", concurrentSessions: "1", deviceLimit: "1", dataQuotaGb: "", timeQuotaHours: "", fairUseAfterGb: "", fairUseDownloadMbps: "", fairUseUploadMbps: "", vlanId: "", ipPool: "", staticIpAllowed: false, dnsServers: "", scheduleStart: "", scheduleEnd: "", idleTimeoutMinutes: "", sessionTimeoutHours: "", firewallProfile: "", serviceEnabled: true });

function fromVersion(current: PolicyVersion): Omit<Draft, "code" | "name" | "description" | "accessType" | "changeNote"> {
  return {
    downloadMbps: String(current.downloadMbps), uploadMbps: String(current.uploadMbps), burstDownloadMbps: current.burstDownloadMbps === undefined ? "" : String(current.burstDownloadMbps),
    burstUploadMbps: current.burstUploadMbps === undefined ? "" : String(current.burstUploadMbps), burstThresholdPercent: current.burstThresholdPercent === undefined ? "" : String(current.burstThresholdPercent),
    burstWindowSeconds: current.burstWindowSeconds === undefined ? "" : String(current.burstWindowSeconds), concurrentSessions: String(current.concurrentSessions), deviceLimit: String(current.deviceLimit),
    dataQuotaGb: current.dataQuotaGb === undefined ? "" : String(current.dataQuotaGb), timeQuotaHours: current.timeQuotaHours === undefined ? "" : String(current.timeQuotaHours),
    fairUseAfterGb: current.fairUseAfterGb === undefined ? "" : String(current.fairUseAfterGb), fairUseDownloadMbps: current.fairUseDownloadMbps === undefined ? "" : String(current.fairUseDownloadMbps),
    fairUseUploadMbps: current.fairUseUploadMbps === undefined ? "" : String(current.fairUseUploadMbps), vlanId: current.vlanId === undefined ? "" : String(current.vlanId),
    ipPool: current.ipPool ?? "", staticIpAllowed: current.staticIpAllowed, dnsServers: current.dnsServers.join(", "), scheduleStart: current.scheduleStart ?? "", scheduleEnd: current.scheduleEnd ?? "",
    idleTimeoutMinutes: current.idleTimeoutMinutes === undefined ? "" : String(current.idleTimeoutMinutes), sessionTimeoutHours: current.sessionTimeoutHours === undefined ? "" : String(current.sessionTimeoutHours),
    firewallProfile: current.firewallProfile ?? "", serviceEnabled: current.serviceEnabled,
  };
}

function optionalNumber(value: string): number | undefined { return value.trim() ? Number(value) : undefined; }
function fieldsFromDraft(draft: Draft): PolicyFields {
  return {
    downloadMbps: Number(draft.downloadMbps), uploadMbps: Number(draft.uploadMbps), burstDownloadMbps: optionalNumber(draft.burstDownloadMbps), burstUploadMbps: optionalNumber(draft.burstUploadMbps),
    burstThresholdPercent: optionalNumber(draft.burstThresholdPercent), burstWindowSeconds: optionalNumber(draft.burstWindowSeconds), concurrentSessions: Number(draft.concurrentSessions), deviceLimit: Number(draft.deviceLimit),
    dataQuotaGb: optionalNumber(draft.dataQuotaGb), timeQuotaHours: optionalNumber(draft.timeQuotaHours), fairUseAfterGb: optionalNumber(draft.fairUseAfterGb), fairUseDownloadMbps: optionalNumber(draft.fairUseDownloadMbps), fairUseUploadMbps: optionalNumber(draft.fairUseUploadMbps),
    vlanId: optionalNumber(draft.vlanId), ipPool: draft.ipPool.trim() || undefined, staticIpAllowed: draft.staticIpAllowed, dnsServers: draft.dnsServers.split(",").map((ip) => ip.trim()).filter(Boolean),
    scheduleStart: draft.scheduleStart || undefined, scheduleEnd: draft.scheduleEnd || undefined, idleTimeoutMinutes: optionalNumber(draft.idleTimeoutMinutes), sessionTimeoutHours: optionalNumber(draft.sessionTimeoutHours),
    firewallProfile: draft.firewallProfile.trim() || undefined, serviceEnabled: draft.serviceEnabled,
  };
}

export function PlatformPolicyTemplates() {
  const { user } = useUserProfile();
  const canManage = canManagePlatformInfrastructure(user?.roles.map((role) => role.slug));
  const [cursor, setCursor] = useState<string | null>(null);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [includeDeleted, setIncludeDeleted] = useState(false);
  const [selected, setSelected] = useState<PolicyTemplate | null>(null);
  const [draft, setDraft] = useState<Draft>(blankDraft);
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const page = useQuery(platformPolicyTemplates.list, { paginationOpts: { numItems: 25, cursor }, includeArchived, includeDeleted });
  const detail = useQuery(platformPolicyTemplates.get, selected ? { templateId: selected._id } : "skip");
  const create = useMutation(platformPolicyTemplates.create);
  const update = useMutation(platformPolicyTemplates.update);
  const restoreVersion = useMutation(platformPolicyTemplates.restoreVersion);
  const setStatus = useMutation(platformPolicyTemplates.setStatus);
  const remove = useMutation(platformPolicyTemplates.remove);
  const restore = useMutation(platformPolicyTemplates.restore);
  const records = page?.items ?? [];

  function startCreate() { setSelected(null); setDraft(blankDraft()); setEditing(true); setError(""); setMessage(""); }
  function startEdit(item: PolicyTemplateWithCurrent) {
    if (!item.current) return;
    setSelected(item.template); setDraft({ ...blankDraft(), ...fromVersion(item.current), code: item.template.code, name: item.template.name, description: item.template.description, accessType: item.template.accessType }); setEditing(true); setError(""); setMessage("");
  }
  function setValue<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft((old) => ({ ...old, [key]: value })); }

  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setWorking(true); setError(""); setMessage("");
    try {
      const fields = fieldsFromDraft(draft);
      if (selected) {
        await update({ templateId: selected._id, expectedVersion: selected.currentVersion, name: draft.name, description: draft.description, accessType: draft.accessType, fields, changeNote: draft.changeNote });
        setMessage("A new policy version was saved.");
      } else {
        await create({ code: draft.code, name: draft.name, description: draft.description, accessType: draft.accessType, fields, changeNote: draft.changeNote });
        setMessage("Policy template created.");
      }
      setEditing(false); setSelected(null);
    } catch (cause) { setError(userFacingMessage(cause, "The policy template could not be saved.")); }
    finally { setWorking(false); }
  }

  async function run(action: () => Promise<unknown>, success: string) {
    setWorking(true); setError(""); setMessage("");
    try { await action(); setMessage(success); }
    catch (cause) { setError(userFacingMessage(cause, "The policy template could not be updated.")); }
    finally { setWorking(false); }
  }

  function loadPreviousVersion(version: PolicyVersion) {
    if (!detail) return;
    const note = window.prompt(`Add a note for creating a new version from version ${version.version}.`);
    if (!note?.trim()) return;
    void run(async () => { await restoreVersion({ templateId: detail.template._id, version: version.version, changeNote: note }); }, `Version ${version.version} copied into a new current version.`);
  }

  return <main className="workspace-page">
    <header className="page-heading"><div><p className="eyebrow">Platform infrastructure</p><h1 className="page-title">Policy templates</h1><p className="page-subtitle">Versioned PPPoE and hotspot policy definitions for review. Saving a template does not change a tenant service or network device.</p></div>{canManage ? <button className="primary-button" type="button" onClick={startCreate}>New template</button> : null}</header>
    <p className="pf-hint">Policy templates are catalog records. Applying a change to a live subscriber or network device requires a separate approved network operation.</p>
    {message ? <p className="platform-claim-message ok" role="status">{message}</p> : null}{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}
    <section className="pf-panel">
      <div className="section-heading"><div><p className="eyebrow">Policy library</p><h2>Network access profiles</h2></div><span className="section-count">{records.length} shown</span></div>
      <div className="tab-row" aria-label="Template visibility"><button className={includeArchived ? "tab-button active" : "tab-button"} type="button" aria-pressed={includeArchived} onClick={() => { setIncludeArchived((value) => !value); setCursor(null); }}>Include archived</button><button className={includeDeleted ? "tab-button active" : "tab-button"} type="button" aria-pressed={includeDeleted} onClick={() => { setIncludeDeleted((value) => !value); setCursor(null); }}>Include deleted</button></div>
      {page === undefined ? <p className="pf-muted">Loading policy templates…</p> : records.length === 0 ? <EmptyState title="No policy templates" body="Create a versioned access profile for operator review." /> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Template</th><th>Access</th><th>Version</th><th>Speed</th><th>Status</th><th>Updated</th><th>Actions</th></tr></thead><tbody>{records.map(({ template, current }) => <tr key={template._id}>
        <td><button type="button" className="text-button" onClick={() => { setSelected(template); setEditing(false); }}>{template.name}</button><small className="table-subtext">{template.code}{template.deletedAt ? " · deleted" : ""}</small></td><td>{template.accessType.toUpperCase()}</td><td>v{template.currentVersion}</td><td>{current ? `${current.downloadMbps}/${current.uploadMbps} Mbps` : "—"}</td><td><StatusPill tone={template.deletedAt ? "danger" : template.status === "active" ? "success" : "neutral"}>{template.deletedAt ? "Deleted" : template.status}</StatusPill></td><td>{new Date(template.updatedAt).toLocaleDateString()}</td><td><div className="cell-actions">{canManage && !template.deletedAt ? <><button className="secondary-button" type="button" onClick={() => startEdit({ template, current })} disabled={!current || working}>Edit</button><button className="secondary-button" type="button" disabled={working} onClick={() => void run(() => setStatus({ templateId: template._id, status: template.status === "active" ? "archived" : "active" }), template.status === "active" ? "Template archived." : "Template reactivated.")}>{template.status === "active" ? "Archive" : "Reactivate"}</button><button className="secondary-button danger" type="button" disabled={working} onClick={() => { const reason = window.prompt("Reason for deleting this template"); if (reason?.trim()) void run(() => remove({ templateId: template._id, reason }), "Template deleted. Its versions remain in the audit history."); }}>Delete</button></> : canManage && template.deletedAt ? <button className="secondary-button" type="button" disabled={working} onClick={() => void run(() => restore({ templateId: template._id }), "Template restored as active.")}>Restore</button> : null}</div></td>
      </tr>)}</tbody></table></div>}
      {page ? <div className="modal-actions"><span className="pf-muted">{page.isDone ? "End of policy library" : "More templates available"}</span><button className="secondary-button" type="button" disabled={page.isDone} onClick={() => setCursor(page.continueCursor)}>Next page</button></div> : null}
    </section>

    {editing ? <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label={selected ? "Edit policy template" : "Create policy template"}><form className="profile-modal-dialog" onSubmit={(event) => void save(event)}><header className="profile-modal-header"><div><p className="eyebrow">Versioned policy</p><h2 className="page-title">{selected ? `Edit ${selected.name}` : "New policy template"}</h2></div><button className="profile-modal-close" type="button" onClick={() => setEditing(false)} aria-label="Close">×</button></header><div className="modal-body"><div className="form-grid">
      {!selected ? <Field label="Template code"><input className="pf-input" required minLength={2} maxLength={40} pattern="[a-z][a-z0-9-]{1,39}" value={draft.code} onChange={(event) => setValue("code", event.target.value)} /></Field> : null}
      <Field label="Name"><input className="pf-input" required minLength={2} maxLength={80} value={draft.name} onChange={(event) => setValue("name", event.target.value)} /></Field>
      <Field label="Access type"><select className="pf-input" value={draft.accessType} onChange={(event) => setValue("accessType", event.target.value as PolicyAccessType)}><option value="pppoe">PPPoE</option><option value="hotspot">Hotspot</option><option value="both">Both</option></select></Field>
      <Field label="Description" wide><textarea className="pf-input" rows={2} maxLength={500} value={draft.description} onChange={(event) => setValue("description", event.target.value)} /></Field>
      <Field label="Download speed (Mbps)"><input className="pf-input" type="number" required min="0.1" max="10000" step="0.1" value={draft.downloadMbps} onChange={(event) => setValue("downloadMbps", event.target.value)} /></Field>
      <Field label="Upload speed (Mbps)"><input className="pf-input" type="number" required min="0.1" max="10000" step="0.1" value={draft.uploadMbps} onChange={(event) => setValue("uploadMbps", event.target.value)} /></Field>
      <Field label="Burst download (Mbps)"><input className="pf-input" type="number" min="0.1" value={draft.burstDownloadMbps} onChange={(event) => setValue("burstDownloadMbps", event.target.value)} /></Field>
      <Field label="Burst upload (Mbps)"><input className="pf-input" type="number" min="0.1" value={draft.burstUploadMbps} onChange={(event) => setValue("burstUploadMbps", event.target.value)} /></Field>
      <Field label="Burst threshold (%)"><input className="pf-input" type="number" min="1" max="100" value={draft.burstThresholdPercent} onChange={(event) => setValue("burstThresholdPercent", event.target.value)} /></Field>
      <Field label="Burst window (seconds)"><input className="pf-input" type="number" min="1" max="3600" value={draft.burstWindowSeconds} onChange={(event) => setValue("burstWindowSeconds", event.target.value)} /></Field>
      <Field label="Concurrent sessions"><input className="pf-input" type="number" required min="1" max="1000" value={draft.concurrentSessions} onChange={(event) => setValue("concurrentSessions", event.target.value)} /></Field>
      <Field label="Device limit"><input className="pf-input" type="number" required min="1" max="1000" value={draft.deviceLimit} onChange={(event) => setValue("deviceLimit", event.target.value)} /></Field>
      <Field label="Data quota (GB)"><input className="pf-input" type="number" min="0.01" value={draft.dataQuotaGb} onChange={(event) => setValue("dataQuotaGb", event.target.value)} /></Field>
      <Field label="Time quota (hours)"><input className="pf-input" type="number" min="0.01" value={draft.timeQuotaHours} onChange={(event) => setValue("timeQuotaHours", event.target.value)} /></Field>
      <Field label="Fair-use threshold (GB)"><input className="pf-input" type="number" min="0.01" value={draft.fairUseAfterGb} onChange={(event) => setValue("fairUseAfterGb", event.target.value)} /></Field>
      <Field label="Fair-use download (Mbps)"><input className="pf-input" type="number" min="0.1" value={draft.fairUseDownloadMbps} onChange={(event) => setValue("fairUseDownloadMbps", event.target.value)} /></Field>
      <Field label="Fair-use upload (Mbps)"><input className="pf-input" type="number" min="0.1" value={draft.fairUseUploadMbps} onChange={(event) => setValue("fairUseUploadMbps", event.target.value)} /></Field>
      <Field label="VLAN ID"><input className="pf-input" type="number" min="1" max="4094" value={draft.vlanId} onChange={(event) => setValue("vlanId", event.target.value)} /></Field>
      <Field label="IP pool name"><input className="pf-input" maxLength={100} value={draft.ipPool} onChange={(event) => setValue("ipPool", event.target.value)} /></Field>
      <Field label="DNS servers (IPv4, comma-separated)" wide><input className="pf-input" placeholder="1.1.1.1, 8.8.8.8" value={draft.dnsServers} onChange={(event) => setValue("dnsServers", event.target.value)} /></Field>
      <Field label="Schedule start (24-hour)"><input className="pf-input" type="time" value={draft.scheduleStart} onChange={(event) => setValue("scheduleStart", event.target.value)} /></Field>
      <Field label="Schedule end (24-hour)"><input className="pf-input" type="time" value={draft.scheduleEnd} onChange={(event) => setValue("scheduleEnd", event.target.value)} /></Field>
      <Field label="Idle timeout (minutes)"><input className="pf-input" type="number" min="1" max="10080" value={draft.idleTimeoutMinutes} onChange={(event) => setValue("idleTimeoutMinutes", event.target.value)} /></Field>
      <Field label="Session timeout (hours)"><input className="pf-input" type="number" min="0.01" value={draft.sessionTimeoutHours} onChange={(event) => setValue("sessionTimeoutHours", event.target.value)} /></Field>
      <Field label="Firewall profile"><input className="pf-input" maxLength={80} value={draft.firewallProfile} onChange={(event) => setValue("firewallProfile", event.target.value)} /></Field>
      <label className="pf-field"><span className="pf-label">Allow static IP</span><input type="checkbox" checked={draft.staticIpAllowed} onChange={(event) => setValue("staticIpAllowed", event.target.checked)} /></label>
      <label className="pf-field"><span className="pf-label">Service enabled in template</span><input type="checkbox" checked={draft.serviceEnabled} onChange={(event) => setValue("serviceEnabled", event.target.checked)} /></label>
      <Field label="Change note" wide><textarea className="pf-input" required minLength={8} maxLength={300} rows={2} value={draft.changeNote} onChange={(event) => setValue("changeNote", event.target.value)} placeholder="Explain the policy change for reviewers" /></Field>
    </div><div className="modal-actions"><button type="button" className="secondary-button" onClick={() => setEditing(false)}>Cancel</button><button className="primary-button" disabled={working}>{working ? "Saving…" : selected ? "Create new version" : "Create template"}</button></div></div></form></div> : null}

    {selected && !editing ? <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Policy template details"><section className="profile-modal-dialog"><header className="profile-modal-header"><div><p className="eyebrow">Version history</p><h2 className="page-title">{detail?.template.name ?? selected.name}</h2><p className="page-subtitle">Current version {detail?.template.currentVersion ?? selected.currentVersion}</p></div><button className="profile-modal-close" type="button" onClick={() => setSelected(null)} aria-label="Close">×</button></header><div className="modal-body">{detail === undefined ? <p className="pf-muted">Loading version history…</p> : detail === null ? <p className="pf-muted">This policy template is unavailable.</p> : <><p className="pf-hint">Each version is immutable. Restoring a prior version creates a new current version with a review note.</p><div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Version</th><th>Saved</th><th>Change note</th><th>Action</th></tr></thead><tbody>{detail.versions.map((version) => <tr key={version._id}><td>v{version.version}{version.version === detail.template.currentVersion ? " · current" : ""}</td><td>{new Date(version.createdAt).toLocaleString()}</td><td>{version.changeNote}</td><td>{canManage && version.version !== detail.template.currentVersion && !detail.template.deletedAt ? <button className="secondary-button" type="button" disabled={working} onClick={() => loadPreviousVersion(version)}>Restore as new version</button> : "—"}</td></tr>)}</tbody></table></div><p className="pf-muted">Showing up to 50 recent versions.</p></>}</div></section></div> : null}
  </main>;
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) { return <label className={`pf-field${wide ? " pf-field-wide" : ""}`}><span className="pf-label">{label}</span>{children}</label>; }
