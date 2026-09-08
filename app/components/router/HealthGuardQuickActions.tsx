"use client";

import { useMutation } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";

const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^.*?Error: /, "") : "The command could not be queued.";

function relativeTime(timestamp: number | undefined): string {
  if (timestamp === undefined) return "Never";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  return `${Math.floor(elapsed / 3_600_000)}h ago`;
}

export type HealthguardQuickState = {
  routerId: Id<"routers">;
  routerName: string;
  lastRunAt?: number;
  wwwSslEnabled: boolean | null;
  stale: boolean;
};

export function HealthGuardQuickActions({ routerId, state, canManage, hideMeta = false }: { routerId: Id<"routers">; state: HealthguardQuickState | undefined; canManage: boolean; hideMeta?: boolean }) {
  const queueCommand = useMutation(api.deviceCommands.queueCommand);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const queue = async (type: "reenable_www_ssl" | "restart_collector") => {
    if (type === "restart_collector" && !window.confirm("Restart collector: the local collector process will stop and restart under its supervisor on its next check-in.\n\nContinue?")) return;
    setBusy(type);
    setMessage(null);
    try {
      const result = await queueCommand({ routerId, type });
      setMessage(result.queued ? "Queued for the collector's next check-in." : "Already queued.");
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(null);
    }
  };

  return <div className="healthguard-actions">
    {canManage ? <div className="page-action-group">
      <button type="button" className="secondary-button" disabled={busy !== null} title="Re-enable the router's www-ssl service and verify it locally." onClick={() => void queue("reenable_www_ssl")}><ShieldCheck size={15} />{busy === "reenable_www_ssl" ? "Queueing…" : "Re-enable www-ssl"}</button>
      <button type="button" className="secondary-button" disabled={busy !== null} title="Restart the supervised collector process. Billing and router traffic are unaffected." onClick={() => void queue("restart_collector")}><RotateCcw size={15} />{busy === "restart_collector" ? "Queueing…" : "Restart collector"}</button>
    </div> : null}
    {hideMeta ? null : <div className="config-watch-meta">
      <div><span>Last check</span><strong>{relativeTime(state?.lastRunAt)}</strong></div>
      <div><span>www-ssl</span><strong>{state?.wwwSslEnabled === true ? "Enabled" : state?.wwwSslEnabled === false ? "Disabled" : "Unknown"}</strong></div>
      <div><span>Health</span><span className={`status-pill ${state?.stale ? "status-pill-warning" : "status-pill-success"}`}>{state?.stale ? "Stale" : "Reporting"}</span></div>
    </div>}
    {message ? <p className="collector-card-message" role="status">{message}</p> : null}
  </div>;
}