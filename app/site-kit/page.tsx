"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { Archive, Boxes, Pencil, Plus, Radio, Router, Wifi } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, ErrorNote, Loading, Select, StatusPill, TextInput } from "@/app/components/ui";
import { useUserProfile } from "@/app/components/UserProfileContext";

type DeviceType = "mikrotik" | "outdoor_ap" | "indoor_ap" | "extender";
const typeIcon: Record<DeviceType, typeof Router> = { mikrotik: Router, outdoor_ap: Radio, indoor_ap: Wifi, extender: Boxes };

type FormState = {
  deviceType: DeviceType;
  approvedModel: string;
  approvedFirmwareVersion: string;
  requiresUps: boolean;
  snmpProfile: string;
  effectiveFrom: string;
};

const newForm = (): FormState => ({
  deviceType: "mikrotik",
  approvedModel: "",
  approvedFirmwareVersion: "",
  requiresUps: false,
  snmpProfile: "",
  effectiveFrom: new Date().toISOString().slice(0, 10),
});

export default function SiteKitPage() {
  const configs = useQuery(api.siteKit.listSiteKitConfigs, {});
  const createConfig = useMutation(api.siteKit.saveSiteKitConfig);
  const updateConfig = useMutation(api.siteKit.updateSiteKitConfig);
  const archiveConfig = useMutation(api.siteKit.archiveSiteKitConfig);
  const { user } = useUserProfile();
  const canManage = user?.permissions?.includes("site_kit:manage") === true;
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(newForm());
  const [error, setError] = useState<string | null>(null);

  if (configs === undefined) return <Loading />;
  const active = configs.filter((config) => config.status === "active");

  const startCreate = () => {
    setEditing(null);
    setForm(newForm());
    setError(null);
  };

  const startEdit = (config: (typeof configs)[number]) => {
    setEditing(config._id);
    setForm({
      deviceType: config.deviceType,
      approvedModel: config.approvedModel,
      approvedFirmwareVersion: config.approvedFirmwareVersion ?? "",
      requiresUps: config.requiresUps,
      snmpProfile: config.snmpProfile ?? "",
      effectiveFrom: config.effectiveFrom,
    });
    setError(null);
  };

  const save = async () => {
    setError(null);
    try {
      if (!form.approvedModel.trim() || !form.effectiveFrom) throw new Error("Model and effective date are required");
      if (editing) {
        await updateConfig({
          configId: editing as never,
          approvedModel: form.approvedModel.trim(),
          approvedFirmwareVersion: form.approvedFirmwareVersion || undefined,
          requiresUps: form.requiresUps,
          snmpProfile: form.snmpProfile || undefined,
          effectiveFrom: form.effectiveFrom,
        });
      } else {
        await createConfig({
          ...form,
          approvedModel: form.approvedModel.trim(),
          approvedFirmwareVersion: form.approvedFirmwareVersion || undefined,
          snmpProfile: form.snmpProfile || undefined,
        });
      }
      setEditing(null);
      setForm(newForm());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save site kit standard");
    }
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div><p className="eyebrow">Administration</p><h1 className="page-title">Site kit</h1><p className="page-subtitle">Approved device standards with auditable create, update and archive controls.</p></div>
        {canManage && <button className="pf-button pf-button-primary" onClick={startCreate}><Plus size={15} /> Add standard</button>}
      </div>
      <div className="metric-grid">
        <MetricCard icon={Boxes} label="Standards" value={configs.length} tone="primary" detail="All versions" />
        <MetricCard icon={Router} label="Active" value={active.length} tone="success" detail="In effect" />
        <MetricCard icon={Radio} label="Require UPS" value={configs.filter((config) => config.requiresUps).length} tone="warning" detail="Standards" />
      </div>
      {canManage && (editing !== null || form.approvedModel !== "") && (
        <div className="section-block"><div className="pf-panel">
          <div className="section-heading"><div><p className="eyebrow">{editing ? "Update" : "Create"}</p><h2>{editing ? "Edit standard" : "New standard"}</h2></div></div>
          {error && <ErrorNote>{error}</ErrorNote>}
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="pf-field"><span className="pf-label">Device role</span><Select value={form.deviceType} onChange={(event) => setForm({ ...form, deviceType: event.target.value as DeviceType })}>{Object.keys(typeIcon).map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</Select></label>
            <label className="pf-field"><span className="pf-label">Approved model *</span><TextInput value={form.approvedModel} onChange={(event) => setForm({ ...form, approvedModel: event.target.value })} /></label>
            <label className="pf-field"><span className="pf-label">Firmware</span><TextInput value={form.approvedFirmwareVersion} onChange={(event) => setForm({ ...form, approvedFirmwareVersion: event.target.value })} /></label>
            <label className="pf-field"><span className="pf-label">SNMP profile</span><TextInput value={form.snmpProfile} onChange={(event) => setForm({ ...form, snmpProfile: event.target.value })} /></label>
            <label className="pf-field"><span className="pf-label">Effective from *</span><TextInput type="date" value={form.effectiveFrom} onChange={(event) => setForm({ ...form, effectiveFrom: event.target.value })} /></label>
            <label className="pf-field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><input type="checkbox" checked={form.requiresUps} onChange={(event) => setForm({ ...form, requiresUps: event.target.checked })} /><span className="pf-label">UPS required</span></label>
          </div>
          <div className="flex justify-end gap-3"><button className="pf-button" onClick={() => { setEditing(null); setForm(newForm()); }}>Cancel</button><button className="pf-button pf-button-primary" onClick={save}>Save standard</button></div>
        </div></div>
      )}
      <div className="section-block"><div className="section-heading"><div><p className="eyebrow">Catalogue</p><h2>Approved device standards</h2></div></div><div className="pf-panel">
        {configs.length === 0 ? <EmptyState title="No standards yet" body="Standards appear once published." /> : <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Role</th><th>Model</th><th className="pf-hide-sm">Firmware</th><th>UPS</th><th className="pf-hide-sm">Effective</th><th>Status</th>{canManage && <th>Actions</th>}</tr></thead><tbody>{configs.map((config) => { const Icon = typeIcon[config.deviceType]; return <tr key={config._id}><td><strong><Icon size={14} style={{ verticalAlign: -2 }} /> {config.deviceType.replaceAll("_", " ")}</strong></td><td>{config.approvedModel}</td><td className="pf-hide-sm">{config.approvedFirmwareVersion ?? "—"}</td><td>{config.requiresUps ? "Required" : "—"}</td><td className="pf-hide-sm">{config.effectiveFrom}</td><td><StatusPill tone={config.status === "active" ? "success" : "warning"}>{config.status}</StatusPill></td>{canManage && <td><button className="pf-button pf-button-compact" onClick={() => startEdit(config)} title="Edit"><Pencil size={14} /></button>{config.status === "active" && <button className="pf-button pf-button-compact" onClick={async () => { if (window.confirm("Archive this standard?")) await archiveConfig({ configId: config._id }); }} title="Archive"><Archive size={14} /></button>}</td>}</tr>; })}</tbody></table></div>}
      </div></div>
    </div>
  );
}
