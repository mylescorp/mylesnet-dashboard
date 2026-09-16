/**
 * Pure staged rollout logic for platform firmware campaigns (spec B6).
 *
 * A firmware rollout campaigns one firmware label across a *bounded* set of
 * fleet devices — by market, device kind, or a single device — and, by
 * design, never rolls to all tenants at once. The operator advances waves
 * explicitly: each `advance` applies at most `waveSize` devices. Everything
 * here is deterministic and free of Convex I/O so it can be unit-tested in
 * isolation (mirrors fleetCore / policyTemplateCore).
 */

export type FirmwareRolloutStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type FirmwareRolloutTransition =
  | "start"
  | "pause"
  | "resume"
  | "complete"
  | "cancel";

export function isFirmwareRolloutStatus(
  value: string,
): value is FirmwareRolloutStatus {
  return (
    value === "draft" ||
    value === "running" ||
    value === "paused" ||
    value === "completed" ||
    value === "cancelled"
  );
}

export type FirmwareRolloutScope =
  | { type: "market"; marketId: string }
  | { type: "device_kind"; deviceKind: string }
  | { type: "single"; deviceId: string };

/**
 * Resolve a rollout scope from its component fields. Exactly one of
 * marketId / deviceKind / deviceId must be set; anything else (including the
 * "all tenants" case where all three are empty) is invalid.
 */
export function resolveRolloutScope(input: {
  marketId: string | null | undefined;
  deviceKind: string | null | undefined;
  deviceId: string | null | undefined;
}): FirmwareRolloutScope | null {
  const setCount =
    (input.marketId != null ? 1 : 0) +
    (input.deviceKind != null ? 1 : 0) +
    (input.deviceId != null ? 1 : 0);
  if (setCount !== 1) return null;
  if (input.marketId != null) return { type: "market", marketId: input.marketId };
  if (input.deviceKind != null) {
    return { type: "device_kind", deviceKind: input.deviceKind };
  }
  // deviceId is non-null here because setCount is exactly 1.
  return { type: "single", deviceId: input.deviceId as string };
}

export type RolloutDeviceLike = {
  _id: string;
  marketId: string | null | undefined;
  deviceKind: string | null | undefined;
};

/** Does a fleet device fall inside the rollout's bounded scope? */
export function firmwareRolloutMatchesDevice(
  scope: FirmwareRolloutScope,
  device: RolloutDeviceLike,
): boolean {
  switch (scope.type) {
    case "market":
      return device.marketId === scope.marketId;
    case "device_kind":
      return device.deviceKind === scope.deviceKind;
    case "single":
      return device._id === scope.deviceId;
  }
}

/**
 * Pick the next wave of devices to upgrade. Convex rows are unordered, so the
 * caller must pass a *stable* candidate ordering (createdAt then _id); this
 * function then skips devices that already applied and returns the first
 * `waveSize` of the remainder. Never returns more than `waveSize`.
 *
 * Generic over the device row shape so callers keep their richer document
 * types (e.g. firmwareVersion) through the selection.
 */
export function devicesForNextWave<T extends RolloutDeviceLike>(
  orderedCandidates: readonly T[],
  alreadyAppliedIds: readonly string[],
  waveSize: number,
): T[] {
  const applied = new Set(alreadyAppliedIds);
  const remaining = orderedCandidates.filter((device) => !applied.has(device._id));
  return remaining.slice(0, Math.max(0, Math.floor(waveSize)));
}

/** Whole-campaign progress: how far has the current wave window progressed? */
export function waveProgress(
  appliedCount: number,
  targetCount: number,
): number {
  if (targetCount <= 0) return 1;
  return Math.min(1, appliedCount / targetCount);
}

/**
 * Transition table for the rollout lifecycle:
 *
 *   draft     → running (start)
 *   running   → paused | completed | cancelled
 *   paused    → running (resume) | cancelled
 *   cancelled → (terminal, nothing)
 *   completed → (terminal, nothing)
 *
 * Illegal transitions return null. `complete` is only meaningful when the
 * campaign has actually applied everything (enforced by the caller against
 * the target count).
 */
export function nextRolloutStatus(
  status: FirmwareRolloutStatus,
  transition: FirmwareRolloutTransition,
): FirmwareRolloutStatus | null {
  if (transition === "start" && status === "draft") return "running";
  if (transition === "pause" && status === "running") return "paused";
  if (transition === "resume" && status === "paused") return "running";
  if (transition === "complete" && status === "running") return "completed";
  if (transition === "cancel" && (status === "draft" || status === "running" || status === "paused")) {
    return "cancelled";
  }
  return null;
}

export function isRolloutLive(status: FirmwareRolloutStatus): boolean {
  return status === "running" || status === "paused";
}

export type FirmwareRolloutRow = {
  _id: string;
  label: string;
  scope: FirmwareRolloutScope;
  waveSize: number;
  status: FirmwareRolloutStatus;
  appliedCount: number;
  targetCount: number;
  progress: number;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
};

export type FirmwareRolloutMergeInput = {
  _id: string;
  label: string;
  marketId: string | null;
  deviceKind: string | null;
  deviceId: string | null;
  waveSize: number;
  status: FirmwareRolloutStatus;
  appliedCount: number;
  targetCount: number;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
};

/** Normalize a rollout row into the flat, serializable row the UI consumes. */
export function buildFirmwareRolloutRow(
  rollout: FirmwareRolloutMergeInput,
): FirmwareRolloutRow {
  const scope = resolveRolloutScope({
    marketId: rollout.marketId,
    deviceKind: rollout.deviceKind,
    deviceId: rollout.deviceId,
  });
  return {
    _id: rollout._id,
    label: rollout.label,
    // If the stored scope is somehow malformed, surface a bounded single-device
    // scope rather than a crash: operational data should never break the panel.
    scope:
      scope ??
      ({ type: "single", deviceId: rollout.deviceId ?? rollout._id } satisfies FirmwareRolloutScope),
    waveSize: rollout.waveSize,
    status: rollout.status,
    appliedCount: rollout.appliedCount,
    targetCount: rollout.targetCount,
    progress: waveProgress(rollout.appliedCount, rollout.targetCount),
    createdBy: rollout.createdBy,
    createdAt: rollout.createdAt,
    updatedAt: rollout.updatedAt,
    startedAt: rollout.startedAt,
    completedAt: rollout.completedAt,
    cancelledAt: rollout.cancelledAt,
  };
}