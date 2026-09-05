"use client";

import { useAction, useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { Activity, FileDiff, Fingerprint, Trash2 } from "lucide-react";
import Link from "next/link";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

function relativeTime(timestamp: number): string {
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 5_000) return "just now";
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  if (elapsed < 86_400_000) return `${Math.floor(elapsed / 3_600_000)}h ago`;
  return `${Math.floor(elapsed / 86_400_000)}d ago`;
}

const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^.*?Error: /, "") : "The change could not be saved.";

export default function ConfigWatchPage() {
  const routers = useQuery(api.routers.listRouters, {});
  if (routers === undefined) {
    return <div className="workspace-page"><div className="loading-panel workspace-card"><Activity aria-hidden="true" size={22} />Loading config watch…</div></div>;
  }
  return <div className="workspace-page"><header className="page-heading"><div><p className="eyebrow">Network operations · Monitoring</p><h1 className="page-title">Config watch</h1><p className="page-subtitle">Capture a snapshot of a router&apos;s monitored RouterOS configuration as a baseline, then compare current snapshots against it to detect unauthorized or unexpected change.</p></div></header>{routers.length === 0 ? <p className="dialog-message">Register a router first — config watch needs a collector configuration snapshot to baseline.</p> : <section className="space-y-4">{routers.map((router) => <BaselineRow key={router._id} routerId={router._id} name={router.name} location={router.location} />)}</section>}</div>;
}

function BaselineRow({ routerId, name, location }: { routerId: Id<"routers">; name: string; location: string }) {
  const baselines = useQuery(api.configWatch.getBaselines, { routerId });
  const captureBaseline = useAction(api.configWatch.captureBaseline);
  const checkConfigDrift = useAction(api.configWatch.checkConfigDrift);
  const deleteBaseline = useMutation(api.configWatch.deleteBaseline);
  const [message, setMessage] = useState("");
  const [drift, setDrift] = useState<{ hasDrift: boolean; message: string; differences: string[]; baselineCapturedAt: number | null } | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const latest = baselines?.[0];

  const handleCapture = async () => {
    setBusy("capture");
    setMessage("");
    try { const result = await captureBaseline({ routerId }); setMessage(result.message); }
    catch (caught) { setMessage(errorText(caught)); } finally { setBusy(null); }
  };
  const handleCheck = async () => {
    setChecking(true);
    setDrift(null);
    try { const result = await checkConfigDrift({ routerId }); setDrift({ hasDrift: result.hasDrift, message: result.message, differences: result.differences, baselineCapturedAt: result.baselineCapturedAt }); }
    catch (caught) { setDrift({ hasDrift: false, message: errorText(caught), differences: [], baselineCapturedAt: null }); }
    finally { setChecking(false); }
  };
  const handleDelete = async (baselineId: Id<"configWatchBaselines">) => {
    if (!window.confirm("Delete this baseline?")) return;
    setBusy(baselineId);
    try { await deleteBaseline({ baselineId }); } catch (caught) { setMessage(errorText(caught)); }
    finally { setBusy(null); }
  };

  return <section className="workspace-card console-card"><div className="section-heading"><div><p className="eyebrow">Config watch · {location}</p><h2><Link href={`/routers/${routerId}`} className="hover:text-orange-700">{name}</Link></h2></div><div className="page-action-group"><button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void handleCapture()}><Fingerprint size={15} />Capture baseline</button><button type="button" className="secondary-button" disabled={checking} onClick={() => void handleCheck()}><FileDiff size={15} />{checking ? "Checking…" : "Check drift"}</button></div></div>
    <div className="config-watch-meta">
      <div><span>Baselines stored</span><strong>{baselines !== undefined ? baselines.length : "…"}</strong></div>
      <div><span>Latest baseline</span><strong>{latest ? relativeTime(latest.capturedAt) : "None"}</strong></div>
      <div><span>Coverage</span>{latest ? <span className="status-pill status-pill-success">Covered</span> : <span className="status-pill status-pill-warning">Not covered</span>}</div>
    </div>
    {message ? <p className="collector-card-message">{message}</p> : null}
    {drift ? <div className={`drift-result ${drift.hasDrift ? "drift-result-drift" : "drift-result-clean"}`}><strong>{drift.hasDrift ? "Drift detected" : "No drift"}</strong><p>{drift.message}</p>{drift.differences.length > 0 ? <ul>{drift.differences.map((difference) => <li key={difference}>{difference}</li>)}</ul> : null}{drift.baselineCapturedAt ? <small>Against baseline from {relativeTime(drift.baselineCapturedAt)}</small> : null}</div> : <p className="console-note">Open the router console to inspect a baseline after it has been captured.</p>}
    {baselines && baselines.length > 0 ? <div className="detail-list setup-steps">{baselines.slice(0, 5).map((baseline) => <div key={baseline._id} className="detail-row"><span><strong>Baseline</strong> · {relativeTime(baseline.capturedAt)}</span><button type="button" className="secondary-button" disabled={busy === baseline._id} onClick={() => void handleDelete(baseline._id)}><Trash2 size={14} />Delete</button></div>)}</div> : null}
  </section>;
}