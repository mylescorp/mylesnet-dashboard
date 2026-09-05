"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { RotateCcw } from "lucide-react";
import { StatusPill, EmptyState, Loading, ErrorNote, formatDateTime } from "@/app/components/ui";

type EntityType = "market" | "device" | "agent";

export default function TrashPage() {
  const [type, setType] = useState<EntityType | "all">("all");
  const entities = useQuery(
    api.trash.listDeletedEntities,
    type === "all" ? {} : { entityType: type }
  );
  const restoreMarket = useMutation(api.markets.restoreMarket);
  const restoreDevice = useMutation(api.devices.restoreDevice);
  const restoreAgent = useMutation(api.agents.restoreAgent);

  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (entities === undefined) return <Loading />;

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setError(null);
    try { await fn(); setMessage(ok); }
    catch (err) { setError(err instanceof Error ? err.message : "Action failed"); }
  };

  return (
    <div className="workspace-page">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Platform</p>
          <h1 className="page-title">Trash</h1>
          <p className="page-subtitle">
            Soft-deleted entities across markets, devices and agents. Restoring never rewrites financial history.
          </p>
        </div>
      </div>

      {error && <ErrorNote>{error}</ErrorNote>}
      {message && <p className="platform-claim-message ok" role="status">{message}</p>}

      <div className="pf-page-toolbar">
        <div className="pf-tools">
          {(["all", "market", "device", "agent"] as const).map((t) => (
            <button
              key={t}
              type="button"
              className={type === t ? "primary-button" : "secondary-button"}
              onClick={() => setType(t)}
              style={{ textTransform: "capitalize" }}
            >
              {t === "all" ? "All" : `${t}s`}
            </button>
          ))}
        </div>
      </div>

      <div className="pf-panel">
        {entities.length === 0 ? (
          <EmptyState title="Trash is empty" body="Nothing has been soft-deleted." />
        ) : (
          <div className="pf-table-wrap">
            <table className="pf-table">
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Name</th>
                  <th>Delete reason</th>
                  <th className="pf-hide-sm">Deleted</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e) => (
                  <tr key={`${e.entityType}-${e.id}`}>
                    <td><StatusPill tone="neutral">{e.entityType}</StatusPill></td>
                    <td><strong>{e.name}</strong></td>
                    <td className="pf-muted">{e.deleteReason ?? "—"}</td>
                    <td className="pf-hide-sm">{formatDateTime(e.deletedAt)}</td>
                    <td className="pf-actions">
                      {e.entityType === "market" && (
                        <button type="button" className="secondary-button" onClick={() => run(() => restoreMarket({ marketId: e.id as Id<"markets"> }), "Market restored.")}>
                          <RotateCcw aria-hidden="true" size={14} /> Restore
                        </button>
                      )}
                      {e.entityType === "device" && (
                        <button type="button" className="secondary-button" onClick={() => run(() => restoreDevice({ deviceId: e.id as Id<"devices"> }), "Device restored.")}>
                          <RotateCcw aria-hidden="true" size={14} /> Restore
                        </button>
                      )}
                      {e.entityType === "agent" && (
                        <button type="button" className="secondary-button" onClick={() => run(() => restoreAgent({ agentId: e.id as Id<"agents"> }), "Agent restored.")}>
                          <RotateCcw aria-hidden="true" size={14} /> Restore
                        </button>
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
  );
}

