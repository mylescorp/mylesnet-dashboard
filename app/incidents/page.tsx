"use client";

import { useQuery, useMutation } from "convex/react";
import { useState } from "react";
import { Plus, TriangleAlert } from "lucide-react";
import type { Id } from "@/convex/_generated/dataModel";
import { api } from "@/convex/_generated/api";
import { EmptyState, ErrorNote, Field, Loading, Select, StatusPill, TextArea, formatDateTime } from "@/app/components/ui";
import { useUserProfile } from "@/app/components/UserProfileContext";
import { effectiveRole } from "@/app/components/nav";

const incidentTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  critical: "danger", warning: "warning",
};
const alertTone: Record<string, "success" | "warning" | "danger" | "neutral"> = {
  open: "danger", acknowledged: "warning", resolved: "success",
};

export default function IncidentsPage() {
  const roles = useQuery(api.incidents.listIncidents, {});
  const alertRows = useQuery(api.alerts.listAlerts, {});
  const routers = useQuery(api.routers.listRouters, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const devices = useQuery(api.devices.listDevices, {});
  const acknowledgeIncident = useMutation(api.incidents.acknowledgeIncident);
  const resolveIncident = useMutation(api.incidents.resolveIncident);
  const createIncident = useMutation(api.incidents.createIncident);
  const acknowledgeAlert = useMutation(api.alerts.acknowledgeAlert);
  const resolveAlert = useMutation(api.alerts.resolveAlert);
  const { user } = useUserProfile();
  const role = effectiveRole(user?.platformRole ?? null);
  const canCreateIncident = role !== "platform_support";
  const canManageAlerts = role === "platform_owner" || role === "platform_admin";

  const [openFilter, setOpenFilter] = useState<"open" | "all">("open");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({ routerId: "", note: "", severity: "warning" });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (roles === undefined || alertRows === undefined || routers === undefined || markets === undefined || devices === undefined) return <Loading />;

  const routerName = (id: Id<"routers">) => routers.find((r) => r._id === id)?.name ?? "#" + String(id).slice(-6);
  const marketName = (id: string) => markets.find((m) => m._id === id)?.name ?? "#" + String(id).slice(-6);
  const deviceName = (id: string) => devices.find((d) => d._id === id)?.name ?? "#" + String(id).slice(-6);

  const visibleIncidents = openFilter === "open"
    ? roles.filter((i) => !i.resolvedAt)
    : roles;
  const visibleAlerts = openFilter === "open"
    ? alertRows.filter((a) => a.alertStatus !== "resolved")
    : alertRows;

  const run = async (fn: () => Promise<unknown>) => {
    setMessage(null);
    try { await fn(); } catch (err) { setMessage(err instanceof Error ? err.message : "Action failed. Please try again."); }
  };

  const handleCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage(null);
    const selectedRouter = routers.find((router) => router._id === formData.routerId);
    if (!selectedRouter) {
      setMessage("Choose a router before creating an incident.");
      setLoading(false);
      return;
    }
    try {
      await createIncident({ routerId: selectedRouter._id, note: formData.note, severity: formData.severity });
      setShowCreateModal(false);
      setFormData({ routerId: "", note: "", severity: "warning" });
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "We could not create this incident. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Network operations · Desk</p>
          <h1 className="page-title">Incident &amp; alert desk</h1>
          <p className="page-subtitle">Unified view of network incidents and root-cause grouped device alerts. Incidents track manual and metric events; alerts are raised once per outage for a market.</p>
        </div>
        <div className="page-action-group">
          {canCreateIncident && (
            <button type="button" className="primary-button" onClick={() => setShowCreateModal(true)}>
              <Plus aria-hidden="true" size={16} />Create incident
            </button>
          )}
        </div>
      </header>

      {message ? <ErrorNote>{message}</ErrorNote> : null}

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          <button type="button" className={openFilter === "open" ? "primary-button" : "secondary-button"} onClick={() => setOpenFilter("open")}>Open</button>
          <button type="button" className={openFilter === "all" ? "primary-button" : "secondary-button"} onClick={() => setOpenFilter("all")}>All</button>
        </div>
      </div>

      <section className="section-block" aria-label="Network incidents">
        <div className="section-heading">
          <div><p className="eyebrow">Manual &amp; metric events</p><h2>Incidents ({roles.filter((i) => !i.resolvedAt).length} open)</h2></div>
        </div>
        <div className="pf-panel">
          {visibleIncidents.length === 0 ? (
            <EmptyState title="No incidents" body={openFilter === "open" ? "No open incidents right now." : "No incidents have been recorded."} />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Note</th>
                    <th className="pf-hide-sm">Router</th>
                    <th>Severity</th>
                    <th>Status</th>
                    <th className="pf-hide-sm">Opened</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleIncidents.map((incident) => (
                    <tr key={incident._id}>
                      <td><strong>{incident.note}</strong></td>
                      <td className="pf-hide-sm">{routerName(incident.routerId)}</td>
                      <td><StatusPill tone={incidentTone[incident.severity] ?? "neutral"}>{incident.severity}</StatusPill></td>
                      <td>
                        {incident.resolvedAt ? <StatusPill tone="success">resolved</StatusPill>
                          : incident.acknowledgedBy ? <StatusPill tone="warning">acknowledged</StatusPill>
                          : <StatusPill tone="danger">open</StatusPill>}
                      </td>
                      <td className="pf-hide-sm">{formatDateTime(incident.openedAt)}</td>
                      <td className="pf-actions">
                        {!incident.resolvedAt && (
                          <>
                            {!incident.acknowledgedBy && (
                              <button type="button" className="secondary-button" onClick={() => run(() => acknowledgeIncident({ incidentId: incident._id }))}>Acknowledge</button>
                            )}
                            <button type="button" className="primary-button" onClick={() => run(() => resolveIncident({ incidentId: incident._id }))}>Resolve</button>
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
      </section>

      <section className="section-block" aria-label="Device alerts">
        <div className="section-heading">
          <div><p className="eyebrow">Root-cause grouped outages</p><h2>Alerts ({alertRows.filter((a) => a.alertStatus !== "resolved").length} open)</h2></div>
        </div>
        <div className="pf-panel">
          {visibleAlerts.length === 0 ? (
            <EmptyState title="No alerts" body="All clear right now." />
          ) : (
            <div className="pf-table-wrap">
              <table className="pf-table">
                <thead>
                  <tr>
                    <th>Message</th>
                    <th className="pf-hide-sm">Market</th>
                    <th>Root device</th>
                    <th>Dependents</th>
                    <th>Status</th>
                    <th className="pf-hide-sm">Opened</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleAlerts.map((alert) => (
                    <tr key={alert._id}>
                      <td><strong>{alert.message}</strong></td>
                      <td className="pf-hide-sm">{marketName(alert.marketId)}</td>
                      <td>{deviceName(alert.rootDeviceId)}</td>
                      <td>{alert.dependentDeviceIds.length > 0 ? alert.dependentDeviceIds.length : "†"}</td>
                      <td><StatusPill tone={alertTone[alert.alertStatus] ?? "neutral"}>{alert.alertStatus}</StatusPill></td>
                      <td className="pf-hide-sm">{formatDateTime(alert.openedAt)}</td>
                      <td className="pf-actions">
                        {canManageAlerts && alert.alertStatus === "open" && (
                          <button type="button" className="secondary-button" onClick={() => run(() => acknowledgeAlert({ alertId: alert._id }))}>Acknowledge</button>
                        )}
                        {canManageAlerts && (alert.alertStatus === "open" || alert.alertStatus === "acknowledged") && (
                          <button type="button" className="primary-button" onClick={() => run(() => resolveAlert({ alertId: alert._id }))}>Resolve</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {showCreateModal ? (
        <div className="operations-modal" role="dialog" aria-modal="true" aria-label="Create incident">
          <form className="operations-dialog workspace-card" onSubmit={handleCreate}>
            <div className="section-heading">
              <div><p className="eyebrow"><TriangleAlert aria-hidden="true" size={16} /> Desk action</p><h2>Create incident</h2></div>
              <button type="button" className="secondary-button" onClick={() => setShowCreateModal(false)}>Close</button>
            </div>
            <div className="pf-form-grid">
              <Field label="Router">
                <Select value={formData.routerId} onChange={(e) => setFormData({ ...formData, routerId: e.target.value })} required>
                  <option value="">Select a router…</option>
                  {routers.map((router) => <option key={router._id} value={router._id}>{router.name} ({router.location})</option>)}
                </Select>
              </Field>
              <Field label="Severity">
                <Select value={formData.severity} onChange={(e) => setFormData({ ...formData, severity: e.target.value })}>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </Select>
              </Field>
              <Field label="Note">
                <TextArea value={formData.note} onChange={(e) => setFormData({ ...formData, note: e.target.value })} required rows={3} placeholder="Describe the incident…" />
              </Field>
            </div>
            <div className="pf-form-actions">
              <button type="submit" className="primary-button" disabled={loading}>{loading ? "Creating…" : <><Plus aria-hidden="true" size={16} />Create incident</>}</button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}