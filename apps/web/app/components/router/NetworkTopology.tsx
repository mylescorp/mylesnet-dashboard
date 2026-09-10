"use client";

import { useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RadioTower, Boxes, Wifi, X } from "lucide-react";

interface NetworkTopologyProps {
  routerId: Id<"routers">;
  onClose: () => void;
}

export function NetworkTopology({ routerId, onClose }: NetworkTopologyProps) {
  const live = useQuery(api.operations.getLiveRouter, { routerId });

  if (!live) {
    return (
      <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Network topology">
        <div className="modal-content workspace-card">
          <div className="modal-header">
            <h2>Network Topology</h2>
            <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
              <X size={20} />
            </button>
          </div>
          <div className="loading-panel">Loading network topology...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="Network topology">
      <div className="modal-content workspace-card topology-modal">
        <div className="modal-header">
          <h2>Network Topology</h2>
          <p className="eyebrow">{live.router.name} · {live.router.location}</p>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="topology-container">
          <div className="topology-node topology-router">
            <div className="node-icon">
              <RadioTower size={32} />
            </div>
            <div className="node-label">
              <strong>{live.router.name}</strong>
              <small>Router</small>
            </div>
          </div>

          {live.switches.map((switchEntry) => (
            <div key={switchEntry._switch._id} className="topology-switch-group">
              <div className="topology-connection connection-vertical" />
              <div className="topology-node topology-switch">
                <div className="node-icon">
                  <Boxes size={28} />
                </div>
                <div className="node-label">
                  <strong>{switchEntry._switch.name}</strong>
                  <small>Switch · {switchEntry._switch.portCount || "?"} ports</small>
                  {switchEntry._switch.routerPort && (
                    <small className="port-label">via {switchEntry._switch.routerPort}</small>
                  )}
                </div>
              </div>

              {switchEntry.linkedAccessPoints.length > 0 && (
                <div className="topology-aps">
                  <div className="topology-connection connection-horizontal" />
                  {switchEntry.linkedAccessPoints.map((ap) => (
                    <div key={ap._id} className="topology-node topology-ap">
                      <div className="node-icon">
                        <Wifi size={20} />
                      </div>
                      <div className="node-label">
                        <strong>{ap.name}</strong>
                        <small>{ap.port}</small>
                        {ap.switchPort && (
                          <small className="port-label">Port {ap.switchPort}</small>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}

          {live.accessPoints
            .filter((ap) => !ap.accessPoint.switchId)
            .map((apEntry) => (
              <div key={apEntry.accessPoint._id} className="topology-node topology-ap direct">
                <div className="node-icon">
                  <Wifi size={20} />
                </div>
                <div className="node-label">
                  <strong>{apEntry.accessPoint.name}</strong>
                  <small>{apEntry.accessPoint.port}</small>
                  <small className="port-label">Direct to router</small>
                </div>
              </div>
            ))}
        </div>

        <div className="topology-legend">
          <div className="legend-item">
            <div className="legend-icon legend-router"><RadioTower size={16} /></div>
            <span>Router</span>
          </div>
          <div className="legend-item">
            <div className="legend-icon legend-switch"><Boxes size={16} /></div>
            <span>Switch</span>
          </div>
          <div className="legend-item">
            <div className="legend-icon legend-ap"><Wifi size={16} /></div>
            <span>Access Point</span>
          </div>
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

