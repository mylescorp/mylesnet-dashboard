"use client";

import { useState, useEffect } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { X, RefreshCw } from "lucide-react";

const formatRelativeTime = (timestamp: number, now: number): string => {
  const elapsed = Math.max(0, now - timestamp);
  if (elapsed < 60_000) return `${Math.floor(elapsed / 1000)}s ago`;
  if (elapsed < 3_600_000) return `${Math.floor(elapsed / 60_000)}m ago`;
  return `${Math.floor(elapsed / 3_600_000)}h ago`;
};

interface SwitchPortMonitorProps {
  switchId: Id<"networkSwitches">;
  routerId: Id<"routers">;
  onClose: () => void;
}

interface PortStatus {
  portNumber: string;
  status: "up" | "down" | "unknown";
  connectedTo?: string;
  lastSeen?: number;
}

export function SwitchPortMonitor({ switchId, routerId, onClose }: SwitchPortMonitorProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const switchData = useQuery(api.networkSwitches.listSwitches, { routerId });
  const currentSwitch = switchData?.find(s => s._id === switchId);
  const accessPoints = useQuery(api.accessPoints.listAccessPoints, { routerId });
  const liveRouter = useQuery(api.operations.getLiveRouter, { routerId });

  // Derive port statuses from data - computed on each render
  const portStatuses: PortStatus[] = [];
  if (currentSwitch?.portCount) {
    for (let i = 1; i <= currentSwitch.portCount; i++) {
      const portNumber = `port ${i}`;
      const linkedAP = accessPoints?.find(
        (ap) => ap.switchId === switchId && ap.switchPort === portNumber
      );

      if (linkedAP && liveRouter) {
        const apHealth = liveRouter.accessPoints.find(
          (ap) => ap.accessPoint._id === linkedAP._id
        );

        portStatuses.push({
          portNumber,
          status: apHealth?.health?.linkState ? "up" : "down",
          connectedTo: linkedAP.name,
          lastSeen: apHealth?.health?.observedAt,
        });
      } else {
        portStatuses.push({
          portNumber,
          status: "unknown",
        });
      }
    }
  }

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 1000);
  };

  const activePorts = portStatuses.filter((p) => p.status === "up").length;
  const totalPorts = portStatuses.length;
  const uptimePercent = totalPorts > 0 ? Math.round((activePorts / totalPorts) * 100) : 0;

  if (!currentSwitch) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Switch port monitor">
        <div className="modal-content workspace-card">
          <div className="modal-header">
            <h2>Switch Port Monitor</h2>
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Switch port monitor">
      <div className="modal-content workspace-card">
        <div className="modal-header">
          <h2>Switch Port Monitor</h2>
          <p className="eyebrow">{currentSwitch.name}</p>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="info-note">
          Port status is derived from access point link state telemetry. Managed switch port telemetry is not currently available.
        </div>

        <div className="port-monitor-header">
          <div className="port-monitor-stats">
            <div className="stat-item">
              <span className="stat-label">Total Ports</span>
              <strong>{totalPorts}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Active</span>
              <strong className="stat-active">{activePorts}</strong>
            </div>
            <div className="stat-item">
              <span className="stat-label">Uptime</span>
              <strong className="stat-uptime">{uptimePercent}%</strong>
            </div>
          </div>
          <button
            type="button"
            className="secondary-button"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw size={16} className={isRefreshing ? "spinning" : ""} />
            Refresh
          </button>
        </div>

        <div className="port-monitor-list">
          {portStatuses.map((port, index) => (
            <div key={index} className="port-monitor-item">
              <div className="port-monitor-info">
                <span className="port-number">{port.portNumber}</span>
                <span className={`port-status ${port.status}`}>
                  {port.status === "up" ? "Active" : port.status === "down" ? "Inactive" : "Unknown"}
                </span>
              </div>
              <div className="port-monitor-details">
                {port.connectedTo ? (
                  <span className="port-connected">Connected to {port.connectedTo}</span>
                ) : (
                  <span className="port-empty">No connection</span>
                )}
                {port.lastSeen && (
                  <span className="port-last-seen">
                    Last seen {formatRelativeTime(port.lastSeen, now)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="modal-actions">
          <button type="button" className="secondary-button" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
