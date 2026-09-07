"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { CalendarClock, FileBarChart, CheckCircle2, XCircle } from "lucide-react";
import MetricCard from "@/app/components/MetricCard";
import { EmptyState, ErrorNote, Field, Loading, Select, StatusPill, TextInput, formatDateTime } from "@/app/components/ui";

export default function ScheduledReportsPage() {
  const reports = useQuery(api.scheduledReports.listScheduledReports, {});
  const exports = useQuery(api.scheduledReports.listReportExports, { limit: 30 });
  const create = useMutation(api.scheduledReports.createScheduledReport);
  const update = useMutation(api.scheduledReports.updateScheduledReport);
  const remove = useMutation(api.scheduledReports.deleteScheduledReport);

  const [name, setName] = useState("");
  const [reportType, setReportType] = useState<"daily_digest" | "investor" | "custom_analytics">("daily_digest");
  const [format, setFormat] = useState<"pdf" | "csv">("pdf");
  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">("daily");
  const [recipients, setRecipients] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (reports === undefined || exports === undefined) return <Loading />;

  const enabled = reports.filter((r) => r.enabled);
  const dueSoon = reports.filter((r) => r.enabled).length;

  async function onCreate() {
    if (!name.trim() || !recipients.trim()) {
      setError("Name and at least one recipient email are required.");
      return;
    }
    setError(null);
    setSaving(true);
    try {
      await create({
        name: name.trim(),
        reportType,
        format,
        frequency,
        recipients: recipients.split(",").map((r) => r.trim()).filter(Boolean),
      });
      setName("");
      setRecipients("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create scheduled report.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Reporting</p>
          <h1 className="page-title">Scheduled reports</h1>
          <p className="page-subtitle">Set-and-forget PDF/CSV exports and digests delivered on a cadence.</p>
        </div>
      </div>

      <div className="metric-grid">
        <MetricCard icon={CalendarClock} label="Schedules" value={reports.length} tone="primary" detail="All" />
        <MetricCard icon={CheckCircle2} label="Enabled" value={enabled.length} tone="success" detail="Running" />
        <MetricCard icon={FileBarChart} label="Recent exports" value={exports.length} tone="accent" detail="In view" />
      </div>

      {error ? <ErrorNote>{error}</ErrorNote> : null}

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">New</p><h2>Create schedule</h2></div>
        </div>
        <div className="pf-panel">
          <div className="pf-form-grid">
            <Field label="Name" required>
              <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Weekly UGX revenue digest" />
            </Field>
            <Field label="Report type" required>
              <Select value={reportType} onChange={(e) => setReportType(e.target.value as typeof reportType)}>
                <option value="daily_digest">Daily digest</option>
                <option value="investor">Investor</option>
                <option value="custom_analytics">Custom analytics</option>
              </Select>
            </Field>
            <Field label="Format" required>
              <Select value={format} onChange={(e) => setFormat(e.target.value as "pdf" | "csv")}>
                <option value="pdf">PDF</option>
                <option value="csv">CSV</option>
              </Select>
            </Field>
            <Field label="Frequency" required>
              <Select value={frequency} onChange={(e) => setFrequency(e.target.value as "daily" | "weekly" | "monthly")}>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </Select>
            </Field>
          </div>
          <Field label="Recipients (comma-separated emails)" required>
            <TextInput value={recipients} onChange={(e) => setRecipients(e.target.value)} placeholder="ops@mylesnet.tech, founder@mylesnet.tech" />
          </Field>
          <button className="primary-button" onClick={onCreate} disabled={saving} style={{ marginTop: 14 }}>
            {saving ? "Creating…" : "Create schedule"}
          </button>
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Schedules</p><h2>Active schedules</h2></div>
        </div>
        <div className="pf-panel">
          {reports.length === 0 ? (
            <EmptyState title="No schedules" body="Create a schedule above to start automated reporting." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Type</th>
                    <th className="pf-hide-sm">Format</th>
                    <th className="pf-hide-sm">Frequency</th>
                    <th className="pf-hide-sm">Last run</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {reports.map((r) => (
                    <tr key={r._id}>
                      <td><strong>{r.name}</strong></td>
                      <td>{r.reportType.replaceAll("_", " ")}</td>
                      <td className="pf-hide-sm">{r.format.toUpperCase()}</td>
                      <td className="pf-hide-sm">{r.frequency}</td>
                      <td className="pf-hide-sm">{r.lastRunAt ? formatDateTime(r.lastRunAt) : "Never"}</td>
                      <td><StatusPill tone={r.enabled ? "success" : "neutral"}>{r.enabled ? "Enabled" : "Disabled"}</StatusPill></td>
                      <td className="pf-actions">
                        <button className="secondary-button" onClick={() => update({ reportId: r._id, enabled: !r.enabled })}>
                          {r.enabled ? "Pause" : "Resume"}
                        </button>
                        <button className="secondary-button" onClick={() => remove({ reportId: r._id })} title="Delete"><XCircle size={14} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="section-block">
        <div className="section-heading">
          <div><p className="eyebrow">Output</p><h2>Recent exports</h2></div>
        </div>
        <div className="pf-panel">
          {exports.length === 0 ? (
            <EmptyState title="No exports yet" body="Generated exports appear here after schedules run." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr><th>Created</th><th className="pf-hide-sm">Dataset</th><th className="pf-hide-sm">Format</th><th>Status</th></tr>
                </thead>
                <tbody>
                  {exports.map((e) => (
                    <tr key={e._id}>
                      <td><strong>{formatDateTime(e.createdAt)}</strong></td>
                      <td className="pf-hide-sm">{e.dataset ?? "—"}</td>
                      <td className="pf-hide-sm">{e.format.toUpperCase()}</td>
                      <td>
                        <StatusPill tone={e.status === "ready" ? "success" : e.status === "failed" ? "danger" : "warning"}>
                          {e.status}
                        </StatusPill>
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
