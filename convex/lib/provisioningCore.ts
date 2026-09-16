/**
 * Pure provisioning queue state logic (spec "Provisioning Queue"). Kept free
 * of Convex imports so `npm test` can exercise it with plain node:test
 * (mirrors tenantCore.ts).
 */

export type ProvisioningStatus = "pending" | "approved" | "rejected" | "deployed";
export type ProvisioningTransition = "approved" | "rejected" | "deployed";

/**
 * Transition table for the device provisioning request lifecycle.
 *   pending → approved | rejected
 *   approved → deployed
 * A request leaves its pending state exactly once via an operator decision,
 * and only an approved request may be marked deployed when the device reports
 * back provisioned. No-ops and illegal transitions return null.
 */
export function nextProvisioningStatus(
  status: ProvisioningStatus,
  transition: ProvisioningTransition,
): ProvisioningStatus | null {
  if (transition === "approved" && status === "pending") return "approved";
  if (transition === "rejected" && status === "pending") return "rejected";
  if (transition === "deployed" && status === "approved") return "deployed";
  return null;
}

/** A request is actionable only while still pending. */
export function isProvisioningPending(status: ProvisioningStatus): boolean {
  return status === "pending";
}

/** Modest firmware label guard: keep stored strings bounded and non-empty. */
export function isValidFirmwareLabel(label: string | null | undefined): boolean {
  if (label === null || label === undefined) return true; // optional field
  const trimmed = label.trim();
  return trimmed.length >= 3 && trimmed.length <= 80;
}
