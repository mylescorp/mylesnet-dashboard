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
