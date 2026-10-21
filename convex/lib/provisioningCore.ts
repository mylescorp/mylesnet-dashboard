/**
 * Pure provisioning queue state logic (spec "Provisioning Queue"). Kept free
 * of Convex imports so `npm test` can exercise it with plain node:test
 * (mirrors tenantCore.ts).
 */

export type ProvisioningStatus = "pending" | "approved" | "rejected" | "deployed";
export type ProvisioningTransition = "approved" | "rejected" | "deployed";
export type ProvisioningRecoveryState = "idle" | "retrying" | "failed" | "recovered";

export function nextProvisioningStatus(
  status: ProvisioningStatus,
  transition: ProvisioningTransition,
): ProvisioningStatus | null {
  if (transition === "approved" && status === "pending") return "approved";
  if (transition === "rejected" && status === "pending") return "rejected";
  if (transition === "deployed" && status === "approved") return "deployed";
  return null;
}

export function normalizeProvisioningTransition(
  status: ProvisioningStatus,
  transition: ProvisioningTransition,
): ProvisioningStatus | null {
  if (transition === "approved") {
    if (status === "approved") return "approved";
    if (status === "pending") return "approved";
    return null;
  }
  if (transition === "rejected") {
    if (status === "rejected") return "rejected";
    if (status === "pending") return "rejected";
    return null;
  }
  if (transition === "deployed") {
    if (status === "deployed") return "deployed";
    if (status === "approved") return "deployed";
    return null;
  }
  return null;
}

export function canRetryProvisioning(status: ProvisioningStatus): boolean {
  return status === "rejected";
}

export function retryProvisioningStatus(status: ProvisioningStatus): ProvisioningStatus | null {
  if (status === "rejected") return "pending";
  return null;
}

export function isProvisioningPending(status: ProvisioningStatus): boolean {
  return status === "pending";
}

/**
 * A request that has not reached a terminal state (pending or approved) still
 * owns its device. Retrying a rejected request must not create a second open
 * request for that device, so both statuses count as "open".
 */
export const PROVISIONING_OPEN_STATUSES = ["pending", "approved"] as const satisfies readonly ProvisioningStatus[];

export function isOpenProvisioningStatus(status: ProvisioningStatus): boolean {
  return status === "pending" || status === "approved";
}

/**
 * Recovery state after an operator decision.
 *
 *   first-time decision        → idle
 *   approve a retried request  → retrying (recovery still in progress)
 *   reject a retried request   → failed   (the recovery attempt did not land)
 */
export function recoveryStateAfterDecision(
  retryCount: number,
  decision: "approved" | "rejected",
): ProvisioningRecoveryState {
  if (retryCount <= 0) return "idle";
  return decision === "rejected" ? "failed" : "retrying";
}

/** Recovery state after a verified deployment: a retried request is recovered. */
export function recoveryStateAfterDeployment(retryCount: number): ProvisioningRecoveryState {
  return retryCount > 0 ? "recovered" : "idle";
}

export type ProvisioningDecisionPlan =
  | { kind: "noop" }
  | { kind: "apply"; status: ProvisioningStatus; recoveryState: ProvisioningRecoveryState };

/**
 * Decide what a decision mutation should do. Returns null for an illegal
 * transition, `{ kind: "noop" }` when the request is already in the target
 * state (so a repeated submit writes nothing), or the status/recovery state to
 * apply otherwise.
 */
export function planProvisioningDecision(
  status: ProvisioningStatus,
  decision: "approved" | "rejected",
  retryCount: number,
): ProvisioningDecisionPlan | null {
  const next = normalizeProvisioningTransition(status, decision);
  if (next === null) return null;
  if (next === status) return { kind: "noop" };
  return { kind: "apply", status: next, recoveryState: recoveryStateAfterDecision(retryCount, decision) };
}

/** Decide what a deployment-recording mutation should do. */
export function planProvisioningDeployment(
  status: ProvisioningStatus,
  retryCount: number,
): ProvisioningDecisionPlan | null {
  const next = normalizeProvisioningTransition(status, "deployed");
  if (next === null) return null;
  if (next === status) return { kind: "noop" };
  return { kind: "apply", status: next, recoveryState: recoveryStateAfterDeployment(retryCount) };
}

export type ProvisioningRetryPlan =
  | { kind: "not_retryable" }
  | { kind: "apply"; status: ProvisioningStatus; recoveryState: ProvisioningRecoveryState };

/** Decide whether a retry is applicable and, if so, the status/recovery to apply. */
export function planProvisioningRetry(status: ProvisioningStatus): ProvisioningRetryPlan {
  const next = retryProvisioningStatus(status);
  if (next === null || !canRetryProvisioning(status)) return { kind: "not_retryable" };
  return { kind: "apply", status: next, recoveryState: "retrying" };
}

export function isValidFirmwareLabel(label: string | null | undefined): boolean {
  if (label === null || label === undefined) return true;
  const trimmed = label.trim();
  return trimmed.length >= 3 && trimmed.length <= 80;
}

export function normalizeProvisioningError(error: unknown): string | null {
  if (error === null || error === undefined) return null;
  let message: string;
  if (error instanceof Error) {
    message = error.message;
  } else if (typeof error === "string") {
    message = error;
  } else {
    try {
      message = String(error);
    } catch {
      return null;
    }
  }
  const trimmed = message.trim();
  if (trimmed.length === 0) return null;
  return trimmed.length > 500 ? trimmed.slice(0, 497) + "..." : trimmed;
}
