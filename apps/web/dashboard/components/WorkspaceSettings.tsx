"use client";

import { useState } from "react";
import { Bell, Building2, CircleDollarSign, MessageSquareText, RotateCcw, Save, Settings2, ShieldCheck } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { PermissionDenied } from "@mylesnet/ui";
import MetricCard from "@/shared/components/MetricCard";
import { Field, Loading, Select, TextArea, TextInput } from "@/shared/components/ui";

type Section = "branding" | "operations" | "billing" | "communications";

type WorkspaceSettings = {
  workspace: { name: string; country: string; timezone: string; currency: string } | null;
  canManage: boolean;
  settings: {
    branding: { networkName: string; supportEmail: string; supportPhone: string; brandColor: string; termsAccepted: boolean };
    operations: { pppoePruneDays: number; hotspotPruneDays: number; preExpiryDays: number; fupWarningPercent: number };
    billing: { autoInvoice: boolean; invoicePrefix: string; walletEnabled: boolean };
    communications: { paymentReceiptTemplate: string; expiryReminderTemplate: string };
  };
};

const sections: Array<{ id: Section; label: string; description: string; icon: typeof Building2 }> = [
  { id: "branding", label: "Branding", description: "Identity and support contact", icon: Building2 },
  { id: "operations", label: "Network operations", description: "PPPoE and Hotspot defaults", icon: Settings2 },
  { id: "billing", label: "Billing", description: "Invoice and wallet behaviour", icon: CircleDollarSign },
  { id: "communications", label: "Messages", description: "Customer notification templates", icon: MessageSquareText },
];

export function WorkspaceSettings() {
  const data = useQuery(api.workspaceSettings.get, {}) as WorkspaceSettings | undefined;
  const update = useMutation(api.workspaceSettings.update);
  const reset = useMutation(api.workspaceSettings.reset);
  const [active, setActive] = useState<Section>("branding");

  if (data === undefined) return <Loading label="Loading workspace settings" />;
  if (data.workspace === null) {
    return <div className="workspace-page"><PermissionDenied title="A tenant workspace is required" body="Settings are available only after your signed-in organization is mapped to an active tenant workspace. Ask a platform administrator to complete the workspace setup." /></div>;
  }

  const activeMeta = sections.find((section) => section.id === active)!;
  const ActiveIcon = activeMeta.icon;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Workspace administration</p>
          <h1 className="page-title">Settings</h1>
          <p className="page-subtitle">Configure approved workspace defaults. Sensitive provider credentials remain protected outside this workspace.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={Building2} label="Workspace" value={data.workspace.name} tone="primary" detail={`${data.workspace.country} · ${data.workspace.currency}`} />
        <MetricCard icon={ShieldCheck} label="Access" value={data.canManage ? "Manage" : "View"} tone={data.canManage ? "success" : "neutral"} detail={data.canManage ? "Changes are audit recorded" : "Ask an administrator to make changes"} />
        <MetricCard icon={Bell} label="Reminders" value={`${data.settings.operations.preExpiryDays} days`} tone="accent" detail="Before subscription expiry" />
      </div>

      <div className="mn-settings">
        <nav className="mn-settings-nav" aria-label="Workspace settings sections">
          {sections.map((section) => {
            const Icon = section.icon;
            const selected = active === section.id;
            return (
              <button key={section.id} type="button" className={`mn-settings-link${selected ? " mn-settings-link-active" : ""}`} onClick={() => setActive(section.id)} aria-current={selected ? "page" : undefined}>
                <Icon size={16} aria-hidden="true" />
                <span>{section.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="mn-settings-content">
          {!data.canManage ? <PermissionDenied title="Settings are view-only" body="Your workspace role can review these defaults, but only an administrator can change them." /> : null}
          <SettingsSection
            key={`${active}-${JSON.stringify(data.settings[active])}`}
            section={active}
            title={activeMeta.label}
            description={activeMeta.description}
            icon={<ActiveIcon size={18} aria-hidden="true" />}
            value={data.settings[active]}
            canManage={data.canManage}
            onSave={async (value) => update({ section: active, value })}
            onReset={async () => reset({ section: active })}
          />
        </div>
      </div>
    </div>
  );
}

function SettingsSection({ section, title, description, icon, value, canManage, onSave, onReset }: {
  section: Section;
  title: string;
  description: string;
  icon: React.ReactNode;
  value: WorkspaceSettings["settings"][Section];
  canManage: boolean;
  onSave: (value: WorkspaceSettings["settings"][Section]) => Promise<unknown>;
  onReset: () => Promise<unknown>;
}) {
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      await onSave(draft);
      setMessage({ kind: "success", text: "Settings saved. Changes are available to this workspace immediately." });
    } catch {
      setMessage({ kind: "error", text: "We could not save these settings. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  const restoreDefaults = async () => {
    if (!canManage) return;
    setSaving(true);
    setMessage(null);
    try {
      await onReset();
      setMessage({ kind: "success", text: "This section was restored to its workspace defaults." });
    } catch {
      setMessage({ kind: "error", text: "We could not restore the defaults. Please try again." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="pf-panel settings-editor" onSubmit={save}>
      <header className="settings-editor-header">
        <span className="settings-editor-icon">{icon}</span>
        <div><h2>{title}</h2><p className="pf-muted">{description}</p></div>
      </header>
      {message ? <div className={message.kind === "error" ? "pf-error" : "settings-success"} role="status">{message.text}</div> : null}

      {section === "branding" ? <BrandingFields value={draft as WorkspaceSettings["settings"]["branding"]} setValue={setDraft} disabled={!canManage || saving} /> : null}
      {section === "operations" ? <OperationsFields value={draft as WorkspaceSettings["settings"]["operations"]} setValue={setDraft} disabled={!canManage || saving} /> : null}
      {section === "billing" ? <BillingFields value={draft as WorkspaceSettings["settings"]["billing"]} setValue={setDraft} disabled={!canManage || saving} /> : null}
      {section === "communications" ? <CommunicationFields value={draft as WorkspaceSettings["settings"]["communications"]} setValue={setDraft} disabled={!canManage || saving} /> : null}

      {canManage ? <footer className="settings-editor-actions"><button type="button" className="pf-button" onClick={() => void restoreDefaults()} disabled={saving}><RotateCcw size={15} /> Restore defaults</button><button className="pf-button pf-button-primary" disabled={saving}><Save size={15} /> {saving ? "Saving…" : "Save changes"}</button></footer> : null}
    </form>
  );
}

function BrandingFields({ value, setValue, disabled }: { value: WorkspaceSettings["settings"]["branding"]; setValue: (value: WorkspaceSettings["settings"]["branding"]) => void; disabled: boolean }) {
  return <div className="settings-field-grid">
    <Field label="Network name"><TextInput value={value.networkName} maxLength={120} disabled={disabled} onChange={(event) => setValue({ ...value, networkName: event.target.value })} /></Field>
    <Field label="Brand colour" hint="Use your approved workspace colour."><TextInput value={value.brandColor} pattern="#[0-9A-Fa-f]{6}" maxLength={7} disabled={disabled} onChange={(event) => setValue({ ...value, brandColor: event.target.value })} /></Field>
    <Field label="Support email"><TextInput type="email" value={value.supportEmail} maxLength={160} disabled={disabled} onChange={(event) => setValue({ ...value, supportEmail: event.target.value })} /></Field>
    <Field label="Support phone"><TextInput type="tel" value={value.supportPhone} maxLength={20} disabled={disabled} onChange={(event) => setValue({ ...value, supportPhone: event.target.value })} /></Field>
    <label className="settings-toggle"><input type="checkbox" checked={value.termsAccepted} disabled={disabled} onChange={(event) => setValue({ ...value, termsAccepted: event.target.checked })} /><span><strong>Terms accepted</strong><small>Confirm that this workspace has accepted its operating terms.</small></span></label>
  </div>;
}

function OperationsFields({ value, setValue, disabled }: { value: WorkspaceSettings["settings"]["operations"]; setValue: (value: WorkspaceSettings["settings"]["operations"]) => void; disabled: boolean }) {
  const number = (key: keyof typeof value) => (event: React.ChangeEvent<HTMLInputElement>) => setValue({ ...value, [key]: Number(event.target.value) });
  return <div className="settings-field-grid">
    <Field label="PPPoE inactive-account prune (days)"><TextInput type="number" min="1" max="3650" value={value.pppoePruneDays} disabled={disabled} onChange={number("pppoePruneDays")} /></Field>
    <Field label="Hotspot inactive-account prune (days)"><TextInput type="number" min="1" max="3650" value={value.hotspotPruneDays} disabled={disabled} onChange={number("hotspotPruneDays")} /></Field>
    <Field label="Pre-expiry reminder (days)"><TextInput type="number" min="1" max="60" value={value.preExpiryDays} disabled={disabled} onChange={number("preExpiryDays")} /></Field>
    <Field label="FUP warning threshold"><Select value={value.fupWarningPercent} disabled={disabled} onChange={(event) => setValue({ ...value, fupWarningPercent: Number(event.target.value) })}><option value="70">70%</option><option value="80">80%</option><option value="90">90%</option></Select></Field>
  </div>;
}

function BillingFields({ value, setValue, disabled }: { value: WorkspaceSettings["settings"]["billing"]; setValue: (value: WorkspaceSettings["settings"]["billing"]) => void; disabled: boolean }) {
  return <div className="settings-field-grid">
    <Field label="Invoice prefix" hint="Letters, numbers and hyphens only."><TextInput value={value.invoicePrefix} maxLength={12} disabled={disabled} onChange={(event) => setValue({ ...value, invoicePrefix: event.target.value })} /></Field>
    <label className="settings-toggle"><input type="checkbox" checked={value.autoInvoice} disabled={disabled} onChange={(event) => setValue({ ...value, autoInvoice: event.target.checked })} /><span><strong>Generate invoices automatically</strong><small>Create an invoice when a billable subscription is due.</small></span></label>
    <label className="settings-toggle"><input type="checkbox" checked={value.walletEnabled} disabled={disabled} onChange={(event) => setValue({ ...value, walletEnabled: event.target.checked })} /><span><strong>Allow subscriber credit</strong><small>Allow payments to remain as credit under approved billing workflows.</small></span></label>
  </div>;
}

function CommunicationFields({ value, setValue, disabled }: { value: WorkspaceSettings["settings"]["communications"]; setValue: (value: WorkspaceSettings["settings"]["communications"]) => void; disabled: boolean }) {
  return <div className="settings-field-grid">
    <Field label="Payment receipt template" hint="Use approved variables such as @first_name, @amount_paid and @package_name."><TextArea rows={5} maxLength={2000} value={value.paymentReceiptTemplate} disabled={disabled} onChange={(event) => setValue({ ...value, paymentReceiptTemplate: event.target.value })} /></Field>
    <Field label="Expiry reminder template" hint="Use approved variables such as @first_name, @package_name and @expiry_date."><TextArea rows={5} maxLength={2000} value={value.expiryReminderTemplate} disabled={disabled} onChange={(event) => setValue({ ...value, expiryReminderTemplate: event.target.value })} /></Field>
  </div>;
}
