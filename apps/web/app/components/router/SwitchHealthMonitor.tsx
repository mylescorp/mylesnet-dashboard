"use client";

import { useState, useEffect } from "react";
import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { Activity, AlertTriangle, CheckCircle, X, Clock } from "lucide-react";

// Helper function for time formatting
const formatRelativeTime = (timestamp: number, now: number): string => {
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  return `${Math.floor(elapsed / 3_600_000)}h ago`;
};

interface SwitchHealthMonitorProps {
  switchId: Id<"networkSwitches">;
  routerId: Id<"routers">;
  onClose: () => void;
}

interface HealthAlert {
  severity: "critical" | "warning" | "info";
  message: string;
  timestamp: number;
}

export function SwitchHealthMonitor({ switchId, routerId, onClose }: SwitchHealthMonitorProps) {
  const [now, setNow] = useState(() => Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const switchData = useQuery(api.networkSwitches.listSwitches, { routerId });
  const currentSwitch = switchData?.find(s => s._id === switchId);
  const accessPoints = useQuery(api.accessPoints.listAccessPoints, { routerId });
  const liveRouter = useQuery(api.operations.getLiveRouter, { routerId });
  const openIncidents = useQuery(api.incidents.listIncidents, { routerId });

  // Derive health status from connected access points
  const healthStatus = (() => {
    if (!currentSwitch || !accessPoints || !liveRouter) {
      return { status: "unknown", message: "Health data unavailable" };
    }

    const linkedAPs = accessPoints.filter(ap => ap.switchId === switchId);
    if (linkedAPs.length === 0) {
      return { status: "warning", message: "No access points connected" };
    }

    const apHealth = linkedAPs.map(ap => {
      const health = liveRouter.accessPoints.find(
        (lap) => lap.accessPoint._id === ap._id
      );
      return {
        name: ap.name,
        healthy: health?.health?.linkState ?? false,
        lastSeen: health?.health?.timestamp,
      };
    });

    const healthyCount = apHealth.filter(h => h.healthy).length;
    const totalCount = apHealth.length;

    if (healthyCount === totalCount) {
      return {
        status: "healthy",
        message: `All ${totalCount} access points online`,
        apHealth
      };
    }

    if (healthyCount === 0) {
      return {
        status: "critical",
        message: `All ${totalCount} access points offline`,
        apHealth
      };
    }

    return {
      status: "warning",
      message: `${healthyCount}/${totalCount} access points online`,
      apHealth
    };
  })();

  // Display actual incidents from the database
  const switchIncidents = openIncidents?.filter(
    (incident) =>
      !incident.resolvedAt &&
      incident.note.includes(`Switch ${currentSwitch?.name}`)
  ) ?? [];

  const alerts: HealthAlert[] = switchIncidents.map((incident) => ({
    severity: incident.severity as "critical" | "warning" | "info",
    message: incident.note,
    timestamp: incident.openedAt,
  }));

  if (!currentSwitch) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Switch health monitor">
        <div className="modal-content workspace-card">
          <div className="modal-header">
            <h2>Switch Health Monitor</h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="loading-panel">Loading switch data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Switch health monitor">
      <div className="modal-content workspace-card">
        <div className="modal-header">
          <h2>Switch Health Monitor</h2>
          <p className="eyebrow">{currentSwitch.name}</p>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="info-note">
          Switch health is derived from connected access point telemetry. Managed switch health data is not currently available.
        </div>

        <div className="health-overview">
          <div className={`health-card health-${healthStatus.status}`}>
            <div className="health-icon">
              {healthStatus.status === "healthy" && <CheckCircle size={32} />}
              {healthStatus.status === "warning" && <AlertTriangle size={32} />}
              {healthStatus.status === "critical" && <AlertTriangle size={32} />}
              {healthStatus.status === "unknown" && <Activity size={32} />}
            </div>
            <div className="health-info">
              <strong className="health-status">{healthStatus.status.toUpperCase()}</strong>
              <p>{healthStatus.message}</p>
            </div>
          </div>
        </div>

        {alerts.length > 0 && (
          <div className="alerts-section">
            <h3>Active Alerts</h3>
            <div className="alerts-list">
              {alerts.map((alert, index) => (
                <div key={index} className={`alert-item alert-${alert.severity}`}>
                  <div className="alert-icon">
                    {alert.severity === "critical" && <AlertTriangle size={16} />}
                    {alert.severity === "warning" && <AlertTriangle size={16} />}
                    {alert.severity === "info" && <Activity size={16} />}
                  </div>
                  <div className="alert-content">
                    <span className="alert-message">{alert.message}</span>
                    <span className="alert-time">
                      <Clock size={12} />
                      {formatRelativeTime(alert.timestamp, now)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {healthStatus.apHealth && (
          <div className="ap-health-section">
            <h3>Access Point Health</h3>
            <div className="ap-health-list">
              {healthStatus.apHealth.map((ap, index) => (
                <div key={index} className="ap-health-item">
                  <span className={`health-dot ${ap.healthy ? "healthy" : "unhealthy"}`} />
                  <strong>{ap.name}</strong>
                  <span className={`health-label ${ap.healthy ? "healthy" : "unhealthy"}`}>
                    {ap.healthy ? "Online" : "Offline"}
                  </span>
                  {ap.lastSeen && (
                    <span className="health-last-seen">
                      Last seen {formatRelativeTime(ap.lastSeen, now)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

