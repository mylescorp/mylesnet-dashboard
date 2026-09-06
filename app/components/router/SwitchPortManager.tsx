"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { X, Save, ChevronDown, ChevronUp } from "lucide-react";
import { withRetry } from "../../hooks/useConvexMutation";

interface SwitchPortManagerProps {
  switchId: Id<"networkSwitches">;
  routerId: Id<"routers">;
  onClose: () => void;
  onSuccess: () => void;
}

interface PortState {
  portNumber: string;
  isConfigured: boolean;
  status: "up" | "down" | "unknown";
  connectedTo?: string;
  speed?: string;
  duplex?: string;
}

export function SwitchPortManager({ switchId, routerId, onClose, onSuccess }: SwitchPortManagerProps) {
  const [ports, setPorts] = useState<PortState[]>([]);
  const [expandedPorts, setExpandedPorts] = useState<Set<number>>(new Set());
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const switchData = useQuery(api.networkSwitches.listSwitches, { routerId });
  const currentSwitch = switchData?.find(s => s._id === switchId);
  const accessPoints = useQuery(api.accessPoints.listAccessPoints, { routerId });

  const updateSwitch = useMutation(api.networkSwitches.updateSwitch);

  // Initialize ports based on switch port count
  if (currentSwitch?.portCount && ports.length === 0) {
    const portCount = currentSwitch.portCount;
    const initialPorts: PortState[] = [];
    for (let i = 1; i <= portCount; i++) {
      initialPorts.push({
        portNumber: `port ${i}`,
        isConfigured: false,
        status: "unknown",
      });
    }
    setPorts(initialPorts);
  }

  const togglePortExpansion = (index: number) => {
    setExpandedPorts(prev => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

  const updatePortStatus = (index: number, updates: Partial<PortState>) => {
    setPorts(prev => prev.map((port, i) => 
      i === index ? { ...port, ...updates } : port
    ));
  };

  const startMonitoring = () => {
    setIsMonitoring(true);
    // In a real implementation, this would poll the switch for port status
    // For now, we'll simulate with the access point data
    if (accessPoints) {
      const updatedPorts = ports.map(port => {
        const linkedAP = accessPoints.find(ap => 
          ap.switchId === switchId && ap.switchPort === port.portNumber
        );
        return {
          ...port,
          isConfigured: !!linkedAP,
          status: linkedAP ? "up" : "down",
          connectedTo: linkedAP?.name,
        };
      });
      setPorts(updatedPorts);
    }
  };

  const savePortConfiguration = async () => {
    try {
      // Convert port states to a description that can be stored
      const configuredPorts = ports.filter(p => p.isConfigured);
      const portDescription = configuredPorts.map(p => 
        `${p.portNumber}: ${p.status} ${p.connectedTo ? `(${p.connectedTo})` : ''}`
      ).join(', ');

      await withRetry(async () => {
        await updateSwitch({
          switchId,
          note: portDescription || undefined,
        });
      }, { maxRetries: 3, retryDelay: 1000 });

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Failed to save port configuration:", error);
      setErrors({ submit: "Failed to save port configuration. Please try again." });
    }
  };

  const activePorts = ports.filter(p => p.isConfigured);
  const configuredCount = activePorts.length;
  const totalCount = ports.length;

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Switch port manager">
      <div className="modal-content workspace-card">
        <div className="modal-header">
          <h2>Switch Port Manager</h2>
          <button 
            type="button" 
            className="icon-button" 
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>
        </div>

        <div className="port-manager-header">
          <div>
            <p className="eyebrow">{currentSwitch?.name || "Switch"}</p>
            <p>Configure and monitor switch ports</p>
          </div>
          <div className="port-manager-actions">
            <button 
              type="button" 
              className="secondary-button"
              onClick={startMonitoring}
              disabled={isMonitoring}
            >
              {isMonitoring ? "Monitoring..." : "Refresh Status"}
            </button>
            <button 
              type="button" 
              className="primary-button"
              onClick={savePortConfiguration}
            >
              <Save size={16} />
              Save Configuration
            </button>
          </div>
        </div>

        <div className="port-stats">
          <span className="stat-pill">Total Ports: {totalCount}</span>
          <span className="stat-pill configured">Configured: {configuredCount}</span>
          <span className="stat-pill active">Active: {activePorts.filter(p => p.status === "up").length}</span>
        </div>

        <div className="port-list">
          {ports.map((port, index) => (
            <div key={index} className="port-item">
              <div className="port-item-header" onClick={() => togglePortExpansion(index)}>
                <div className="port-item-info">
                  <strong>{port.portNumber}</strong>
                  <span className={`port-status ${port.status === "up" ? "status-up" : port.status === "down" ? "status-down" : "status-unknown"}`}>
                    {port.status === "up" ? "▲ Active" : port.status === "down" ? "▼ Inactive" : "? Unknown"}
                  </span>
                </div>
                <div className="port-item-toggle">
                  {expandedPorts.has(index) ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>
              </div>

              {expandedPorts.has(index) && (
                <div className="port-item-details">
                  <div className="port-detail-row">
                    <span>Status:</span>
                    <span className={`status-badge ${port.status}`}>{port.status}</span>
                  </div>
                  {port.connectedTo && (
                    <div className="port-detail-row">
                      <span>Connected to:</span>
                      <span>{port.connectedTo}</span>
                    </div>
                  )}
                  {port.speed && (
                    <div className="port-detail-row">
                      <span>Speed:</span>
                      <span>{port.speed}</span>
                    </div>
                  )}
                  {port.duplex && (
                    <div className="port-detail-row">
                      <span>Duplex:</span>
                      <span>{port.duplex}</span>
                    </div>
                  )}
                  <div className="port-detail-row">
                    <span>Configuration:</span>
                    <button
                      type="button"
                      className={`config-toggle ${port.isConfigured ? "configured" : ""}`}
                      onClick={() => updatePortStatus(index, { isConfigured: !port.isConfigured })}
                    >
                      {port.isConfigured ? "Configured" : "Not Configured"}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {errors.submit && <div className="error-banner">{errors.submit}</div>}

        <div className="modal-actions">
          <button
            type="button"
            className="secondary-button"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}