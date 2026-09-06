"use client";

import { useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { X } from "lucide-react";

interface SwitchHistoryProps {
  switchId: Id<"networkSwitches">;
  routerId: Id<"routers">;
  onClose: () => void;
}

interface HistoricalData {
  date: string;
  activePorts: number;
  totalPorts: number;
  uptime: number;
  connectedAPs: number;
}

export function SwitchHistory({ switchId, routerId, onClose }: SwitchHistoryProps) {
  const switchData = useQuery(api.networkSwitches.listSwitches, { routerId });
  const currentSwitch = switchData?.find(s => s._id === switchId);
  const accessPoints = useQuery(api.accessPoints.listAccessPoints, { routerId });
  const liveRouter = useQuery(api.operations.getLiveRouter, { routerId });

  // Historical data is not currently available from stored telemetry
  // This component shows current state only until historical switch performance
  // tracking is added to the Convex schema
  const historicalData: HistoricalData[] = useMemo(() => {
    if (!currentSwitch || !accessPoints || !liveRouter) return [];

    const linkedAPs = accessPoints.filter(ap => ap.switchId === switchId);
    const totalPorts = currentSwitch.portCount || 0;
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

    // Show current state only - historical data requires dedicated table
    const activePorts = linkedAPs.length;
    const uptime = totalPorts > 0 ? Math.round((activePorts / totalPorts) * 100) : 0;

    return [{
      date: dateStr,
      activePorts,
      totalPorts,
      uptime,
      connectedAPs: linkedAPs.length,
    }];
  }, [currentSwitch, accessPoints, liveRouter, switchId]);

  const latest = historicalData[historicalData.length - 1];

  if (!currentSwitch) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Switch history">
        <div className="modal-content workspace-card">
          <div className="modal-header">
            <h2>Switch Performance History</h2>
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
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Switch history">
      <div className="modal-content workspace-card">
        <div className="modal-header">
          <h2>Switch Performance Status</h2>
          <p className="eyebrow">{currentSwitch.name} · Current state</p>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {latest && (
          <div className="history-summary">
            <div className="summary-card">
              <span className="summary-label">Current Uptime</span>
              <strong>{latest.uptime}%</strong>
            </div>
            <div className="summary-card">
              <span className="summary-label">Connected APs</span>
              <strong>{latest.connectedAPs}</strong>
            </div>
          </div>
        )}

        <div className="info-note">
          Historical switch performance data is not currently available. This view shows current configuration and access point status only.
        </div>

        <div className="history-table">
          <div className="history-table-header">
            <span>Date</span>
            <span>Active Ports</span>
            <span>Uptime</span>
            <span>Connected APs</span>
          </div>
          {historicalData.map((data, index) => (
            <div key={index} className="history-table-row">
              <span className="history-date">{data.date}</span>
              <span className="history-value">{data.activePorts}/{data.totalPorts}</span>
              <span className={`history-value ${data.uptime >= 90 ? "value-good" : data.uptime >= 70 ? "value-warning" : "value-bad"}`}>
                {data.uptime}%
              </span>
              <span className="history-value">{data.connectedAPs}</span>
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
