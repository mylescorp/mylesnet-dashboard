/**
 * Pure state logic shared by the device command queue and the healthguard
 * report processor. Kept free of Convex imports so `npm test` can exercise it
 * with plain node:test (mirrors centipidVerify.ts).
 */

export type DeviceCommandStatus = "pending" | "acknowledged" | "completed" | "failed" | "superseded";
export type DeviceCommandTransition = "acknowledged" | "completed" | "failed";

/**
 * Transition table for the command lifecycle. A collector reports outcomes
 * the same way every run, so a no-op result (null) means "leave as-is" rather
 * than an error.
 */
export function nextCommandStatus(
  status: DeviceCommandStatus,
  transition: DeviceCommandTransition,
): DeviceCommandStatus | null {
  if (transition === "acknowledged" && status === "pending") return "acknowledged";
  if (transition === "completed" && status === "acknowledged") return "completed";
  if (transition === "failed" && (status === "pending" || status === "acknowledged")) return "failed";
  return null;
}

/** Keep only re-enable timestamps inside the rolling observation window. */
export function pruneReenableWindow(
  timestamps: number[],
  now: number,
  windowMs: number,
): number[] {
  return timestamps.filter((timestamp) => timestamp > now - windowMs);
}

/**
 * Adds a new re-enable to the rolling window (deduped by exact timestamp so a
 * collector restart cannot double-count one action) and returns the pruned
 * list plus the count of re-enables within the window.
 */
export function countReenablesInWindow(
  previousTimestamps: number[],
  newestReenableAt: number | undefined,
  now: number,
  windowMs: number,
  maxRecords: number,
): { reenableTimestamps: number[]; count: number } {
  let window = pruneReenableWindow(previousTimestamps, now, windowMs);
  if (newestReenableAt !== undefined && !window.includes(newestReenableAt)) {
    window = [...window, newestReenableAt].slice(-maxRecords);
  }
  window = pruneReenableWindow(window, now, windowMs);
  return { reenableTimestamps: window, count: window.length };
}

/** Chronic re-enable alerting: count at/above the threshold. */
export function isChronic(count: number, threshold: number): boolean {
  return Number.isFinite(threshold) && threshold > 0 && count >= threshold;
}