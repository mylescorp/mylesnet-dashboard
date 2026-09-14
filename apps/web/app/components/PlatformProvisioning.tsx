"use client";

import { useMemo, useState } from "react";
import { CheckCircle2, Cpu, Plus, ServerCog, XCircle } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { provisioning, type ProvisioningRequest, type ProvisioningStatus } from "@/lib/convex/provisioning";

const statusTone: Record<ProvisioningStatus, "success" | "warning" | "danger" | "neutral"> = {
  pending: "warning", approved: "success", rejected: "danger", deployed: "neutral",
};

const FILTERS: { key: ProvisioningStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "deployed", label: "Deployed" },
  { key: "rejected", label: "Rejected" },
];

export function PlatformProvisioning() {
  const requests = useQuery(provisioning.listRequests, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const decide = useMutation(provisioning.decide);
  const markDeployed = useMutation(provisioning.markDeployed);
  const [activeFilter, setActiveFilter] = useState<ProvisioningStatus | "all">("pending");
  const [creating, setCreating] = useState(false);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => ({
    total: requests?.length ?? 0,
    pending: requests?.filter((r) => r.status === "pending").length ?? 0,
    approved: requests?.filter((r) => r.status === "approved").length ?? 0,
    deployed: requests?.filter((r) => r.status === "deployed").length ?? 0,
  }), [requests]);

  const visible = useMemo(() => {
    if (!requests) return undefined;
    if (activeFilter === "all") return requests;
    return requests.filter((r) => r.status === activeFilter);
  }, [requests, activeFilter]);

  const marketName = (request: ProvisioningRequest) =>
    markets?.find((market) => market._id === request.marketId)?.name ?? request.marketId;

  const run = async (request: ProvisioningRequest, fn: (requestId: string) => Promise<unknown>, success: string) => {
    setError(null); setNotice(null); setWorkingId(request._id);
    try {
      await fn(request._id);
      setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Provisioning action failed.");
    } finally { setWorkingId(null); }
  };

  return (
    <div className="workspace-page provisioning-page">
      <header className="page-heading">
        <div><p className="eyebrow">Platform control plane</p><h1 className="page-title">Provisioning queue</h1><p className="page-subtitle">Device provisioning requests awaiting platform review. Approve to admit a self-registered device into the managed estate, or reject with a note.</p></div>
        <button type="button" className="primary-button" onClick={() => { setError(null); setNotice(null); setCreating(true); }}><Plus size={17} aria-hidden="true" />Open request</button>
      </header>

      <section className="metric-grid" aria-label="Provisioning queue summary">
        <Metric icon={<Cpu size={19} />} label="Total requests" value={counts.total} detail="All time" />
        <Metric icon={<ServerCog size={19} />} label="Pending review" value={counts.pending} detail="Awaiting operator decision" tone={counts.pending ? "warning" : "success"} />
        <Metric icon={<CheckCircle2 size={19} />} label="Approved" value={counts.approved} detail="Admitted, awaiting deploy" tone="success" />
        <Metric icon={<CheckCircle2 size={19} />} label="Deployed" value={counts.deployed} detail="Provisioned in the estate" />
      </section>

      {notice ? <p className="platform-claim-message ok" role="status">{notice}</p> : null}
      {error ? <p className="platform-claim-message" role="alert">{error}</p> : null}

      <section className="pf-panel">
        <div className="section-heading"><div><p className="eyebrow">Queue</p><h2>Provisioning requests</h2></div><span className="section-count">{counts.pending} pending</span></div>
        <div className="tab-row" role="tablist" aria-label="Filter provisioning requests">
          {FILTERS.map((filter) => <button key={filter.key} type="button" role="tab" aria-selected={activeFilter === filter.key} className={activeFilter === filter.key ? "tab-button active" : "tab-button"} onClick={() => setActiveFilter(filter.key)}>{filter.label}</button>)}
        </div>
        {visible === undefined ? <p className="pf-muted">Loading provisioning queue…</p> : visible.length === 0 ? (
          <div className="tenant-empty-state"><ServerCog size={26} aria-hidden="true" /><h3>No {activeFilter === "all" ? "" : `${activeFilter} `}requests</h3><p>Devices that self-register can be queued here for platform approval. Open a request to provision a device into the managed estate.</p><button type="button" className="primary-button" onClick={() => setCreating(true)}>Open a provisioning request</button></div>
        ) : (
          <div className="pf-table-wrap"><table className="pf-table"><thead><tr><th>Requested</th><th>Market</th><th>Device</th><th>Firmware</th><th>Requester</th><th>Status</th><th>Decision</th><th /></tr></thead><tbody>
            {visible.map((request) => <tr key={request._id}><td><strong>{new Date(request.requestedAt).toLocaleDateString()}</strong><small className="table-subtext">{new Date(request.requestedAt).toLocaleTimeString()}</small></td><td>{marketName(request)}</td><td>{request.deviceId ? <span className="text-mono">{request.deviceId}</span> : <span className="pf-muted">—</span>}</td><td>{request.requestedFirmware ?? <span className="pf-muted">default</span>}</td><td>{request.requesterName ?? request.requesterId}</td><td><span className={`status-pill status-pill-${statusTone[request.status]}`}>{request.status}</span></td><td>{request.decidedAt ? <div><span>{request.decidedByName ?? request.decidedBy}</span><small className="table-subtext">{new Date(request.decidedAt).toLocaleDateString()}{request.decisionNote ? ` · ${request.decisionNote}` : ""}</small></div> : <span className="pf-muted">—</span>}</td><td><div className="cell-actions">{request.status === "pending" ? <>
              <button type="button" className="secondary-button" disabled={workingId === request._id} onClick={() => void run(request, (id) => decide({ requestId: id, decision: "approved" }), "Request approved. The device may now be deployed.")}><CheckCircle2 size={14} aria-hidden="true" />Approve</button>
              <button type="button" className="secondary-button danger" disabled={workingId === request._id} onClick={() => void run(request, (id) => decide({ requestId: id, decision: "rejected", note: "Rejected by operator" }), "Request rejected.")}><XCircle size={14} aria-hidden="true" />Reject</button>
            </> : request.status === "approved" ? <button type="button" className="secondary-button" disabled={workingId === request._id} onClick={() => void run(request, (id) => markDeployed({ requestId: id }), "Marked deployed.")}><CheckCircle2 size={14} aria-hidden="true" />Mark deployed</button> : null}</div></td></tr>)}
          </tbody></table></div>
        )}
      </section>
      {creating ? <OpenProvisioningDialog onClose={() => setCreating(false)} onOpened={(message) => { setNotice(message); setCreating(false); }} /> : null}
    </div>
  );
}

function Metric({ icon, label, value, detail, tone = "accent" }: { icon: React.ReactNode; label: string; value: number; detail: string; tone?: "accent" | "success" | "warning" }) { return <article className={`metric-card workspace-card metric-card-${tone}`}><span className="metric-icon">{icon}</span><p>{label}</p><strong>{value}</strong><small>{detail}</small></article>; }

function OpenProvisioningDialog({ onClose, onOpened }: { onClose: () => void; onOpened: (message: string) => void }) {
  const markets = useQuery(api.markets.listMarkets, {});
  const openRequest = useMutation(provisioning.requestDeviceProvisioning);
  const [form, setForm] = useState({ marketId: "", deviceId: "", requestedFirmware: "" });
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const change = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setError(null); setWorking(true);
    try {
      if (!form.marketId) throw new Error("Choose a market for this device.");
      const marketId = form.marketId;
      await openRequest({ marketId, deviceId: form.deviceId || undefined, requestedFirmware: form.requestedFirmware || undefined });
      onOpened("Provisioning request opened for review.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not open the provisioning request.");
    } finally { setWorking(false); }
  };
  return <div className="profile-modal-overlay" role="dialog" aria-modal="true" aria-label="Open provisioning request" onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}><form className="profile-modal-dialog" onSubmit={save}><header className="profile-modal-header"><div><p className="eyebrow">Provisioning</p><h2 className="page-title">Open a provisioning request</h2></div><button type="button" className="profile-modal-close" onClick={onClose} aria-label="Close dialog">×</button></header><div className="modal-body"><p className="pf-hint">A device must be approved by a platform operator before it is treated as part of the managed estate.</p>{error ? <p className="platform-claim-message" role="alert">{error}</p> : null}<div className="form-grid"><label className="pf-field"><span className="pf-label">Market</span><select className="pf-input" required value={form.marketId} onChange={(event) => change("marketId", event.target.value)}>{!form.marketId ? <option value="">Select a market…</option> : null}{(markets ?? []).map((market) => <option key={market._id} value={market._id}>{market.name}</option>)}</select></label><label className="pf-field"><span className="pf-label">Requested firmware</span><input className="pf-input" value={form.requestedFirmware} onChange={(event) => change("requestedFirmware", event.target.value)} placeholder="e.g. v6.49.10" /></label><label className="pf-field pf-field-wide"><span className="pf-label">Device ID</span><input className="pf-input" value={form.deviceId} onChange={(event) => change("deviceId", event.target.value)} placeholder="Optional — link to an existing device record" /></label></div><div className="modal-actions"><button type="button" className="secondary-button" onClick={onClose}>Cancel</button><button type="submit" className="primary-button" disabled={working}>{working ? "Opening…" : "Open request"}</button></div></div></form></div>;
}