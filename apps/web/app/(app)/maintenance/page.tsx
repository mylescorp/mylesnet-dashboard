"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { CalendarClock, CheckCircle2, XCircle, Wrench } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, ErrorNote, Field, Loading, StatusPill, TextInput, Select, TextArea, formatDateTime } from "@/app/components/ui";
import type { Id } from "@/convex/_generated/dataModel";

export default function MaintenancePage() {
  const windows = useQuery(api.maintenance.listMaintenanceWindows, { includeClosed: true });
  const markets = useQuery(api.markets.listMarkets, {});
  const createWindow = useMutation(api.maintenance.createMaintenanceWindow);
  const cancelWindow = useMutation(api.maintenance.cancelMaintenanceWindow);
  const completeWindow = useMutation(api.maintenance.completeMaintenanceWindow);

  const [marketId, setMarketId] = useState<Id<"markets"> | "">("");
  const [reason, setReason] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [suppressAlerts, setSuppressAlerts] = useState(false);
  const [notes, setNotes] = useState("");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  if (windows === undefined || markets === undefined) return <Loading />;

  const upcoming = windows.filter((w) => w.status === "scheduled" && w.scheduledEnd > now);
  const active = windows.filter((w) => w.status === "active");
  const completed = windows.filter((w) => w.status === "completed");

  async function onSchedule() {
    if (!marketId || !reason || !start || !end) {
      setError("Market, reason, start and end are required.");
      return;
    }
    const scheduledStart = new Date(start).getTime();
    const scheduledEnd = new Date(end).getTime();
    if (scheduledEnd <= scheduledStart) {
      setError("End must be after start.");
      return;
    }
    setError(null);
    setCreating(true);
    try {
      await createWindow({ marketId, scheduledStart, scheduledEnd, reason, suppressAlerts, notes: notes || undefined });
      setReason("");
      setStart("");
      setEnd("");
      setNotes("");
      setSuppressAlerts(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to schedule window.");
    } finally {
      setCreating(false);
    }
  }

  const marketName = (id: string) => markets.find((m) => m._id === id)?.name ?? id;

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Operations</p>
          <h1 className="page-title">Maintenance windows</h1>
          <p className="page-subtitle">Plan downtime so the NOC suppresses alerts and customers know what to expect.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={CalendarClock} label="Scheduled" value={upcoming.length} tone="primary" detail="In the future" />
        <MetricCard icon={Wrench} label="In progress" value={active.length} tone={active.length > 0 ? "warning" : "neutral"} detail="Now" />
        <MetricCard icon={CheckCircle2} label="Completed" value={completed.length} tone="success" detail="All time" />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Schedule</p><h2>New maintenance window</h2></div>
        </div>
        <div className="pf-panel">
          <div className="pf-form-grid">
            <Field label="Market" required>
              <Select value={marketId} onChange={(e) => setMarketId(e.target.value as Id<"markets"> | "")}>
                <option value="">Select market…</option>
                {markets.map((m) => <option key={m._id} value={m._id}>{m.name}</option>)}
              </Select>
            </Field>
            <Field label="Starts" required>
              <TextInput type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Ends" required>
              <TextInput type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
            <Field label="Reason" required>
              <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Backhaul upgrade, firmware, tower…" />
            </Field>
            <Field label="Notes">
              <TextArea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Optional context for the NOC" />
            </Field>
            <label className="access-role-check">
              <input type="checkbox" checked={suppressAlerts} onChange={(e) => setSuppressAlerts(e.target.checked)} />
              <span>Suppress alerts during the window</span>
            </label>
          </div>
          <button className="primary-button" onClick={onSchedule} disabled={creating}>
            {creating ? "Scheduling…" : "Schedule window"}
          </button>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Agenda</p><h2>Windows</h2></div>
        </div>
        <div className="pf-panel">
          {windows.length === 0 ? (
            <EmptyState title="No maintenance windows" body="Schedule downtime to keep the NOC calm during maintenance." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Window</th>
                    <th>Market</th>
                    <th>Start</th>
                    <th className="pf-hide-sm">End</th>
                    <th>Status</th>
                    <th className="pf-hide-sm">Alerts</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[...windows].sort((a, b) => a.scheduledStart - b.scheduledStart).map((w) => (
                    <tr key={w._id}>
                      <td><strong>{w.reason}</strong></td>
                      <td>{marketName(w.marketId)}</td>
                      <td>{formatDateTime(w.scheduledStart)}</td>
                      <td className="pf-hide-sm">{formatDateTime(w.scheduledEnd)}</td>
                      <td><StatusPill tone={w.status === "scheduled" ? "neutral" : w.status === "active" ? "warning" : w.status === "completed" ? "success" : "danger"}>{w.status}</StatusPill></td>
                      <td className="pf-hide-sm">{w.suppressAlerts ? "Suppressed" : "Live"}</td>
                      <td className="pf-actions">
                        {w.status === "scheduled" && (
                          <>
                            <button className="secondary-button" onClick={() => completeWindow({ windowId: w._id })} title="Mark completed"><CheckCircle2 size={14} /></button>
                            <button className="secondary-button" onClick={() => cancelWindow({ windowId: w._id })} title="Cancel window"><XCircle size={14} /></button>
                          </>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
