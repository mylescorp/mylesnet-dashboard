"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Plus, Trash2 } from "lucide-react";
import { Field, Select, TextInput, StatusPill, EmptyState, Loading, ErrorNote } from "../components/ui";

const KINDS = ["mikrotik_gateway", "cpe220", "cpe710", "indoor_ap", "other"] as const;

const KIND_LABEL: Record<string, string> = {
  mikrotik_gateway: "MikroTik gateway",
  cpe220: "CPE 220",
  cpe710: "CPE 710",
  indoor_ap: "Indoor AP",
  other: "Other",
};

const lifecycleTone = (s: string) =>
  s === "active" ? "success" : s === "maintenance" ? "warning" : s === "suspended" ? "neutral" : "danger";

export default function DevicesPage() {
  const [marketId, setMarketId] = useState<string>("");
  const devices = useQuery(api.devices.listDevices, marketId ? { marketId: marketId as any } : {});
  const markets = useQuery(api.markets.listMarkets);
  const createDevice = useMutation(api.devices.createDevice);
  const setMaintenance = useMutation(api.devices.setDeviceMaintenance);
  const softDelete = useMutation(api.devices.softDeleteDevice);

  const [name, setName] = useState("");
  const [deviceKind, setDeviceKind] = useState<(typeof KINDS)[number]>("cpe220");
  const [parentDeviceId, setParentDeviceId] = useState("");
  const [serialOrMac, setSerialOrMac] = useState("");
  const [createMarketId, setCreateMarketId] = useState("");
  const [deleteReason, setDeleteReason] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const filteredMarkets = markets ?? [];
  const gatewayOptions = (devices ?? []).filter((d) => d.deviceKind === "mikrotik_gateway" && (!marketId || d.marketId === marketId));
  const defaultMarketId = marketId || filteredMarkets[0]?._id || "";

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!createMarketId) {
      setError("Choose a market first.");
      return;
    }
    try {
      await createDevice({
        marketId: createMarketId as any,
        parentDeviceId: parentDeviceId ? (parentDeviceId as any) : undefined,
        name,
        deviceKind,
        serialOrMac: serialOrMac || undefined,
      });
      setMessage(`Device "${name}" created.`);
      setName("");
      setSerialOrMac("");
      setParentDeviceId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create device");
    }
  };

  const handleDelete = async (deviceId: string, deviceName: string) => {
    setError(null);
    const reason = deleteReason[deviceId]?.trim();
    if (!reason) {
      setError(`Provide a delete reason for "${deviceName}".`);
      return;
    }
    try {
      await softDelete({ deviceId: deviceId as any, deleteReason: reason });
      setMessage(`Device "${deviceName}" soft-deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete device");
    }
  };

  if (devices === undefined || markets === undefined) return <Loading />;

  const visible = marketId ? devices.filter((d) => d.marketId === (marketId as any)) : devices;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Devices</h1>
          <p className="page-subtitle">MikroTik gateways and access points, scoped by market.</p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          <Field label="Filter by market">
            <Select value={marketId} onChange={(e) => setMarketId(e.target.value)}>
              <option value="">All markets</option>
              {filteredMarkets.map((m) => (
                <option key={m._id} value={m._id as string}>{m.name}</option>
              ))}
            </Select>
          </Field>
        </div>
      </div>

      <form className="pf-panel" style={{ marginBottom: 22 }} onSubmit={handleCreate}>
        <h2>Add a device</h2>
        <p className="pf-muted">Register a gateway or access point. Pick a parent gateway for APs.</p>
        <div className="pf-form-grid">
          <Field label="Market">
            <Select value={createMarketId || defaultMarketId} onChange={(e) => setCreateMarketId(e.target.value)} required>
              <option value="" disabled>Select market…</option>
              {filteredMarkets.map((m) => (
                <option key={m._id} value={m._id as string}>{m.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Device kind">
            <Select value={deviceKind} onChange={(e) => setDeviceKind(e.target.value as (typeof KINDS)[number])}>
              {KINDS.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </Select>
          </Field>
          <Field label="Parent gateway">
            <Select value={parentDeviceId} onChange={(e) => setParentDeviceId(e.target.value)}>
              <option value="">None (this is a gateway)</option>
              {gatewayOptions.map((g) => (
                <option key={g._id} value={g._id as string}>{g.name}</option>
              ))}
            </Select>
          </Field>
          <Field label="Device name">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Tayari-GW1" />
          </Field>
          <Field label="Serial / MAC">
            <TextInput value={serialOrMac} onChange={(e) => setSerialOrMac(e.target.value)} placeholder="Optional" />
          </Field>
        </div>
        <div className="pf-form-actions">
          <button type="submit" className="primary-button"><Plus aria-hidden="true" size={16} /> Create device</button>
        </div>
      </form>

      <div className="pf-panel">
        <h2>Device inventory ({visible.length})</h2>
        {visible.length === 0 ? (
          <EmptyState title="No devices" body="Create a device above, or change the market filter." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Device</th>
                  <th className="pf-hide-sm">Kind</th>
                  <th className="pf-hide-sm">Serial / MAC</th>
                  <th>Lifecycle</th>
                  <th className="pf-hide-sm">Parent</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((d) => (
                  <tr key={d._id}>
                    <td><strong>{d.name}</strong></td>
                    <td className="pf-hide-sm">{KIND_LABEL[d.deviceKind]}</td>
                    <td className="pf-hide-sm">{d.serialOrMac ?? "—"}</td>
                    <td><StatusPill tone={lifecycleTone(d.lifecycleStatus)}>{d.lifecycleStatus}</StatusPill></td>
                    <td className="pf-hide-sm">{d.parentDeviceId ? "#" + String(d.parentDeviceId).slice(-6) : "—"}</td>
                    <td className="pf-actions">
                      <TextInput
                        placeholder="Delete reason"
                        value={deleteReason[d._id] ?? ""}
                        onChange={(e) => setDeleteReason((r) => ({ ...r, [d._id]: e.target.value }))}
                        style={{ width: 150 }}
                      />
                      <button
                        type="button"
                        className="secondary-button"
                        onClick={() => setMaintenance({ deviceId: d._id, inMaintenance: d.lifecycleStatus !== "maintenance" })}
                      >
                        {d.lifecycleStatus === "maintenance" ? "Reactivate" : "Maintenance"}
                      </button>
                      <button type="button" className="danger-button" onClick={() => handleDelete(d._id, d.name)}>
                        <Trash2 aria-hidden="true" size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
