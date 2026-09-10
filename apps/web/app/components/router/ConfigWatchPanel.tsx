"use client";

import { useAction, useMutation, useQuery } from "@/app/lib/convex";
import { useState } from "react";
import { FileDiff, Fingerprint, Trash2 } from "lucide-react";
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

function JsonViewer({ value, compact = false }: { value: unknown; compact?: boolean }) {
  const rendered = typeof value === "string" ? value : JSON.stringify(value, null, 2) ?? "—";
  const isArray = Array.isArray(value);
  const count = isArray ? value.length : undefined;
  const preview = compact && rendered.length > 3200 ? `${rendered.slice(0, 3200)}\n… truncated` : rendered;
  return <div><p className="console-note">{isArray ? `${count} record${count === 1 ? "" : "s"} · snapshot below` : "Snapshot below"}</p><pre className="json-viewer">{preview}</pre></div>;
}

interface DriftResult {
  hasDrift: boolean;
  message: string;
  differences: string[];
  baselineCapturedAt: number | null;
}

/**
 * Shared config-watch body: baseline capture, drift checks and baseline history.
 * Used by the router console Configuration tab and the standalone Config watch page.
 */
export function ConfigWatchPanel({ routerId }: { routerId: Id<"routers"> }) {
  const baselines = useQuery(api.configWatch.getBaselines, { routerId });
  const latestBaseline = useQuery(api.configWatch.getLatestBaseline, { routerId });
  const captureBaseline = useAction(api.configWatch.captureBaseline);
  const checkConfigDrift = useAction(api.configWatch.checkConfigDrift);
  const deleteBaseline = useMutation(api.configWatch.deleteBaseline);
  const [message, setMessage] = useState("");
  const [drift, setDrift] = useState<DriftResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const latest = baselines?.[0];
  const latestInfo = latestBaseline?.capturedAt ?? latest?.capturedAt ?? null;

  const handleCapture = async () => {
    setBusy("capture");
    setMessage("");
    try { const result = await captureBaseline({ routerId }); setMessage(result.message); }
    catch (caught) { setMessage(errorText(caught)); } finally { setBusy(null); }
  };
  const handleCheck = async () => {
    setChecking(true);
    setDrift(null);
    try {
      const result = await checkConfigDrift({ routerId });
      setDrift({ hasDrift: result.hasDrift, message: result.message, differences: result.differences, baselineCapturedAt: result.baselineCapturedAt });
    }
    catch (caught) { setDrift({ hasDrift: false, message: errorText(caught), differences: [], baselineCapturedAt: null }); }
    finally { setChecking(false); }
  };
  const handleDelete = async (baselineId: Id<"configWatchBaselines">) => {
    if (!window.confirm("Delete this baseline?")) return;
    setBusy(baselineId);
    try { await deleteBaseline({ baselineId }); } catch (caught) { setMessage(errorText(caught)); }
    finally { setBusy(null); }
  };

  return <div className="config-watch-panel">
    <div className="page-action-group">
      <button type="button" className="secondary-button" disabled={busy !== null} onClick={() => void handleCapture()}><Fingerprint size={15} />Capture baseline</button>
      <button type="button" className="secondary-button" disabled={checking} onClick={() => void handleCheck()}><FileDiff size={15} />{checking ? "Checking…" : "Check drift"}</button>
    </div>

    <div className="config-watch-meta">
      <div><span>Baselines stored</span><strong>{baselines !== undefined ? baselines.length : "…"}</strong></div>
      <div><span>Latest baseline</span><strong>{latestInfo ? relativeTime(latestInfo) : "None"}</strong></div>
      <div><span>Coverage</span>{latestInfo ? <span className="status-pill status-pill-success">Covered</span> : <span className="status-pill status-pill-warning">Not covered</span>}</div>
    </div>

    {message ? <p className="collector-card-message">{message}</p> : null}
    {drift ? <div className={`drift-result ${drift.hasDrift ? "drift-result-drift" : "drift-result-clean"}`}><strong>{drift.hasDrift ? "Drift detected" : "No drift"}</strong><p>{drift.message}</p>{drift.differences.length > 0 ? <ul>{drift.differences.map((difference) => <li key={difference}>{difference}</li>)}</ul> : null}{drift.baselineCapturedAt ? <small>Against baseline from {relativeTime(drift.baselineCapturedAt)}</small> : null}</div> : <p className="console-note">Capture a baseline from the current collector snapshot, then check for drift whenever you suspect an unauthorized change.</p>}

    {latestBaseline ? <JsonViewer value={latestBaseline.snapshotJson} compact /> : null}

    {baselines && baselines.length > 0 ? <div className="detail-list setup-steps">{baselines.slice(0, 5).map((baseline) => <div key={baseline._id} className="detail-row"><span><strong>Baseline</strong> · {relativeTime(baseline.capturedAt)}</span><button type="button" className="secondary-button" disabled={busy === baseline._id} onClick={() => void handleDelete(baseline._id)}><Trash2 size={14} />Delete</button></div>)}</div> : <p className="dialog-message">No configuration baseline has been captured for this router.</p>}
  </div>;
}
