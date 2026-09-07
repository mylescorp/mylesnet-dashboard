"use client";

import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { HeartPulse, RefreshCw, RotateCcw, ShieldCheck } from "lucide-react";
import { useState } from "react";

const errorText = (error: unknown) => error instanceof Error ? error.message.replace(/^.*?Error: /, "") : "The command could not be queued.";

const commandDefinitions = [
  { type: "reenable_www_ssl" as const, label: "Restore HTTPS admin", description: "Re-enable the router's www-ssl service and verify it locally." },
  { type: "run_full_healthcheck" as const, label: "Run full health check", description: "Run an immediate RouterOS healthguard check without changing collector supervision." },
  { type: "restart_collector" as const, label: "Restart collector", description: "Restart the supervised collector process. Billing and router traffic are unaffected." },
];

function relativeTime(timestamp: number | undefined): string {
  if (timestamp === undefined) return "Never";
  const elapsed = Math.max(0, Date.now() - timestamp);
  if (elapsed < 60_000) return "just now";
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  return `${Math.floor(elapsed / 3_600_000)}h ago`;
}

export function HealthGuardPanel({ routerId }: { routerId: Id<"routers"> }) {
  const overview = useQuery(api.deviceCommands.getRouterHealthguardOverview, { routerId });
  const queueCommand = useMutation(api.deviceCommands.queueCommand);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const queue = async (type: (typeof commandDefinitions)[number]["type"]) => {
    const definition = commandDefinitions.find((item) => item.type === type);
    if (!definition) return;
    if (type === "restart_collector" && !window.confirm(`${definition.label}: ${definition.description}\n\nContinue?`)) return;
    setBusy(type);
    setMessage(null);
    try {
      const result = await queueCommand({ routerId, type });
      setMessage(result.queued ? `${definition.label} queued for the next collector check-in.` : `${definition.label} is already queued.`);
    } catch (error) {
      setMessage(errorText(error));
    } finally {
      setBusy(null);
    }
  };

  const state = overview?.state;
  return <section className="workspace-card console-card">
    <div className="section-heading">
      <div><p className="eyebrow">Self-healing controls</p><h2><HeartPulse size={18} aria-hidden="true" /> HealthGuard</h2></div>
      <span className={`status-pill ${overview?.healthguardEnabled ? "status-pill-success" : "status-pill-warning"}`}><ShieldCheck size={13} />{overview === undefined ? "Loading" : overview.healthguardEnabled ? "Enabled" : "Disabled"}</span>
    </div>
    <div className="config-watch-meta">
      <div><span>Last check</span><strong>{relativeTime(state?.lastRunAt)}</strong></div>
      <div><span>www-ssl</span><strong>{state?.wwwSslEnabled === true ? "Enabled" : state?.wwwSslEnabled === false ? "Disabled" : "Unknown"}</strong></div>
      <div><span>Re-enables / 24h</span><strong>{state?.reenableCount24h ?? 0}</strong></div>
    </div>
    {state?.lastActionMessage ? <p className="collector-card-message">{state.lastActionMessage}</p> : null}
    {message ? <p className="collector-card-message" role="status">{message}</p> : null}
    <div className="page-action-group">
      {commandDefinitions.map((definition) => <button key={definition.type} type="button" className="secondary-button" disabled={busy !== null || overview?.healthguardEnabled === false} title={definition.description} onClick={() => void queue(definition.type)}>
        {definition.type === "restart_collector" ? <RotateCcw size={15} /> : definition.type === "run_full_healthcheck" ? <RefreshCw size={15} /> : <ShieldCheck size={15} />}
        {busy === definition.type ? "Queueing…" : definition.label}
      </button>)}
    </div>
    {overview?.commands && overview.commands.length > 0 ? <div className="detail-list" style={{ marginTop: 12 }}>{overview.commands.slice(0, 4).map((command) => <div className="detail-row" key={command.commandId}><span><strong>{command.type.replaceAll("_", " ")}</strong><small> · requested {relativeTime(command.requestedAt)}</small></span><span className="status-pill status-pill-neutral">{command.status}</span></div>)}</div> : <p className="console-note">Commands remain pending until the local collector checks in and confirms the result.</p>}
  </section>;
}
