"use client";

import { useMemo, useState } from "react";
import { Forward, Plus, Rocket, Save } from "lucide-react";
import { useMutation, useQuery } from "@/app/lib/convex";
import { api } from "@/convex/_generated/api";
import { useUserProfile } from "./UserProfileContext";
import { fleet } from "@/lib/convex/fleet";
import {
  firmwareRollout,
  type FirmwareRolloutRow,
  type FirmwareRolloutStatus,
} from "@/lib/convex/firmwareRollout";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Drafts" },
  { key: "running", label: "Running" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
] as const;

type StatusTone = "neutral" | "warning" | "success" | "danger";
const STATUS_TONE: Record<FirmwareRolloutStatus, StatusTone> = {
  draft: "neutral",
  running: "warning",
  paused: "neutral",
  completed: "success",
  cancelled: "danger",
};

const canEdit = (roles: { slug: string }[] | undefined) =>
  roles?.some((role) =>
    ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug),
  );

function scopeLabel(row: FirmwareRolloutRow): string {
  switch (row.scope.type) {
    case "market":
      return `Market ${row.scope.marketId.slice(0, 8)}…`;
    case "device_kind":
      return `${row.scope.deviceKind} devices`;
    case "single":
      return `Single device ${row.scope.deviceId.slice(0, 8)}…`;
  }
}

export function PlatformFirmwareRollout() {
  const { user } = useUserProfile();
  const rollouts = useQuery(firmwareRollout.list, {});
  const fleetRows = useQuery(fleet.list, {});
  const markets = useQuery(api.markets.listMarkets, {});
  const createRollout = useMutation(firmwareRollout.create);
  const startRollout = useMutation(firmwareRollout.start);
  const advanceRollout = useMutation(firmwareRollout.advance);
  const pauseRollout = useMutation(firmwareRollout.pause);
  const resumeRollout = useMutation(firmwareRollout.resume);
  const completeRollout = useMutation(firmwareRollout.complete);
  const cancelRollout = useMutation(firmwareRollout.cancel);

  const [filter, setFilter] = useState<string>("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newScope, setNewScope] = useState<
    "market" | "device_kind" | "single"
  >("market");
  const [newMarketId, setNewMarketId] = useState("");
  const [newDeviceKind, setNewDeviceKind] = useState("");
  const [newDeviceId, setNewDeviceId] = useState("");
  const [newWaveSize, setNewWaveSize] = useState(10);

  const editable = canEdit(user?.roles);

  const deviceKinds = useMemo(
    () =>
      Array.from(new Set((fleetRows ?? []).map((r) => r.deviceKind))).sort(),
    [fleetRows],
  );

  const visible = useMemo(() => {
    if (!rollouts) return undefined;
    if (filter === "all") return rollouts;
    return rollouts.filter((r) => r.status === filter);
  }, [rollouts, filter]);

  const metrics = useMemo(
    () => ({
      total: rollouts?.length ?? 0,
      running: rollouts?.filter((r) => r.status === "running").length ?? 0,
      paused: rollouts?.filter((r) => r.status === "paused").length ?? 0,
      completed: rollouts?.filter((r) => r.status === "completed").length ?? 0,
    }),
    [rollouts],
  );

  const confirmed = (message: string): boolean =>
    typeof window !== "undefined" && window.confirm(message);

  const run = async (
    action: () => Promise<unknown>,
    success: string,
  ): Promise<void> => {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(success);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action failed.");
    }
  };

  return (
    <div className="workspace-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">Platform control plane</p>
          <h1 className="page-title">Firmware rollout</h1>
          <p className="page-subtitle">
            Staged firmware campaigns over the fleet. A rollout targets exactly
            one bound — market, device kind, or a single device — never all
            tenants — and applies waves of at most <code>waveSize</code>{" "}
            devices per advance.
          </p>
        </div>
      </header>

      {error ? (
        <p className="platform-claim-message" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="platform-notice" role="status">
          {notice}
        </p>
      ) : null}

      <section className="metric-grid" aria-label="Rollout summary">
        <Metric label="Campaigns" value={metrics.total} detail="across all time" />
        <Metric label="Running" value={metrics.running} detail="live waves" />
        <Metric label="Paused" value={metrics.paused} detail="held waves" />
        <Metric label="Completed" value={metrics.completed} detail="rolled out" />
      </section>

      <section className="section-heading">
        <div>
          <p className="eyebrow">Campaigns</p>
          <h2>Firmware rollouts</h2>
        </div>
        <div className="section-heading-actions">
          {editable ? (
            <button
              type="button"
              className="secondary-button"
              onClick={() => setShowCreate((v) => !v)}
            >
              <Plus size={16} aria-hidden="true" /> New campaign
            </button>
          ) : null}
        </div>
      </section>

      {showCreate && editable ? (
        <form
          className="platform-form"
          onSubmit={async (event) => {
            event.preventDefault();
            try {
              const args: {
                label: string;
                waveSize: number;
                marketId?: string;
                deviceKind?: string;
                deviceId?: string;
              } = { label: newLabel, waveSize: newWaveSize };
              if (newScope === "market" && newMarketId) args.marketId = newMarketId;
              if (newScope === "device_kind" && newDeviceKind) {
                args.deviceKind = newDeviceKind;
              }
              if (newScope === "single" && newDeviceId) args.deviceId = newDeviceId;
              await createRollout(args);
              setNotice(`Campaign "${newLabel}" created (draft).`);
              setShowCreate(false);
              setNewLabel("");
              setNewScope("market");
              setNewMarketId("");
              setNewDeviceKind("");
              setNewDeviceId("");
              setNewWaveSize(10);
            } catch (caught) {
              setError(caught instanceof Error ? caught.message : "Create failed.");
            }
          }}
        >
          <div className="platform-form-grid">
            <label>
              <span className="pf-field-label">Firmware label</span>
              <input
                value={newLabel}
                onChange={(event) => setNewLabel(event.target.value)}
                placeholder="e.g. 6.49.15"
                required
              />
            </label>
            <label>
              <span className="pf-field-label">Wave size (devices per advance)</span>
              <input
                type="number"
                min={1}
                max={500}
                value={newWaveSize}
                onChange={(event) => setNewWaveSize(Number(event.target.value))}
                required
              />
            </label>
          </div>
          <fieldset className="platform-form-fieldset">
            <legend className="pf-field-label">Scope — exactly one bound</legend>
            <label>
              <input
                type="radio"
                name="scope"
                checked={newScope === "market"}
                onChange={() => setNewScope("market")}
              />{" "}
              Market
            </label>
            <label>
              <input
                type="radio"
                name="scope"
                checked={newScope === "device_kind"}
                onChange={() => setNewScope("device_kind")}
              />{" "}
              Device kind
            </label>
            <label>
              <input
                type="radio"
                name="scope"
                checked={newScope === "single"}
                onChange={() => setNewScope("single")}
              />{" "}
              Single device
            </label>
          </fieldset>
          {newScope === "market" ? (
            <label>
              <span className="pf-field-label">Market</span>
              <select
                value={newMarketId}
                onChange={(event) => setNewMarketId(event.target.value)}
                required
              >
                <option value="">Select a market…</option>
                {(markets ?? []).map((market) => (
                  <option key={market._id} value={market._id}>
                    {market.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {newScope === "device_kind" ? (
            <label>
              <span className="pf-field-label">Device kind</span>
              <select
                value={newDeviceKind}
                onChange={(event) => setNewDeviceKind(event.target.value)}
                required
              >
                <option value="">Select a device kind…</option>
                {deviceKinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {kind}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          {newScope === "single" ? (
            <label>
              <span className="pf-field-label">Device</span>
              <select
                value={newDeviceId}
                onChange={(event) => setNewDeviceId(event.target.value)}
                required
              >
                <option value="">Select a device…</option>
                {(fleetRows ?? []).map((row) => (
                  <option key={row._id} value={row._id}>
                    {row.name} ({row.marketName ?? "no market"})
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div className="platform-form-actions">
            <button type="submit" className="secondary-button">
              <Save size={16} aria-hidden="true" /> Create draft
            </button>
          </div>
        </form>
      ) : null}

      <div className="tab-row" role="tablist" aria-label="Filter rollouts">
        {STATUS_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={filter === key}
            className={`tab-button ${filter === key ? "tab-button-active" : ""}`}
            onClick={() => setFilter(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {rollouts === undefined ? (
        <p className="pf-muted">Loading rollouts…</p>
      ) : visible?.length === 0 ? (
        <div className="tenant-empty-state">
          <Rocket size={26} aria-hidden="true" />
          <h3>
            No {filter === "all" ? "" : `${filter} `}rollouts
          </h3>
          <p>
            Create a campaign to stage a firmware label across a market, device
            kind, or single device.
          </p>
        </div>
      ) : (
        <div className="table-scroll">
          <table className="pf-table">
            <thead>
              <tr>
                <th>Label</th>
                <th>Scope</th>
                <th>Wave size</th>
                <th>Applied</th>
                <th>Progress</th>
                <th>Status</th>
                {editable ? <th className="pf-action-col">Action</th> : null}
              </tr>
            </thead>
            <tbody>
              {visible?.map((row) => (
                <tr key={row._id}>
                  <td className="pf-cell-main">{row.label}</td>
                  <td>{scopeLabel(row)}</td>
                  <td>{row.waveSize}</td>
                  <td>
                    {row.appliedCount} / {row.targetCount}
                  </td>
                  <td>{Math.round(row.progress * 100)}%</td>
                  <td>
                    <span className={`pf-badge pf-badge-${STATUS_TONE[row.status]}`}>
                      {row.status}
                    </span>
                  </td>
                  {editable ? (
                    <td className="pf-action-col">
                      {row.status === "draft" ? (
                        <button
                          type="button"
                          className="secondary-button"
                          onClick={() =>
                            run(
                              () => startRollout({ rolloutId: row._id }),
                              `Campaign "${row.label}" started.`,
                            )
                          }
                        >
                          Start
                        </button>
                      ) : row.status === "running" ? (
                        <>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              run(
                                () => advanceRollout({ rolloutId: row._id }),
                                `Next wave applied for "${row.label}".`,
                              )
                            }
                          >
                            <Forward size={14} aria-hidden="true" /> Wave
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              run(
                                () => pauseRollout({ rolloutId: row._id }),
                                `Campaign "${row.label}" paused.`,
                              )
                            }
                          >
                            Pause
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              confirmed(
                                `Complete "${row.label}"? Remaining devices stay as-is.`,
                              )
                                ? run(
                                    () => completeRollout({ rolloutId: row._id }),
                                    `Campaign "${row.label}" completed.`,
                                  )
                                : undefined
                            }
                          >
                            Complete
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              confirmed(
                                `Cancel "${row.label}"? Applied devices keep the new label.`,
                              )
                                ? run(
                                    () => cancelRollout({ rolloutId: row._id }),
                                    `Campaign "${row.label}" cancelled.`,
                                  )
                                : undefined
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : row.status === "paused" ? (
                        <>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              run(
                                () => resumeRollout({ rolloutId: row._id }),
                                `Campaign "${row.label}" resumed.`,
                              )
                            }
                          >
                            Resume
                          </button>
                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              confirmed(
                                `Cancel "${row.label}"? Applied devices keep the new label.`,
                              )
                                ? run(
                                    () => cancelRollout({ rolloutId: row._id }),
                                    `Campaign "${row.label}" cancelled.`,
                                  )
                                : undefined
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <span className="pf-muted">—</span>
                      )}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Metric({
  label,
  value,
  detail,
}: {
  label: string;
  value: string | number;
  detail: string;
}) {
  return (
    <div className="metric-card">
      <p className="metric-label">{label}</p>
      <p className="metric-value">{value}</p>
      <p className="metric-detail">{detail}</p>
    </div>
  );
}