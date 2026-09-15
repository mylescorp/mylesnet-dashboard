/**
 * Pure tenant retention-lifecycle logic for A3 (30-day soft-delete window).
 * Kept free of Convex imports so `npm test` can exercise it with plain
 * node:test (mirrors tenantCore.ts / marketDependenciesCore.ts). The Convex
 * wrappers in `./tenant.ts`/`./tenantControl.ts` route every deletion, restore
 * and purge attempt through these guards — a caller can never reach a purge
 * without an elapsed retention window.
 */

import type { TenantStatus } from "./tenantCore";

/** Length of the soft-delete window opened by a deletion request. */
export const TENANT_RETENTION_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

/** The minimum structural view of a tenant the lifecycle guards need. */
export interface TenantLifecycleState {
  status: TenantStatus;
  deletedAt?: number;
  deletionRequestedAt?: number;
  purgeEligibleAt?: number;
}

/** The timestamp after which a pending-deletion tenant may be purged. */
export function purgeEligibleAt(deletionRequestedAt: number): number {
  return deletionRequestedAt + TENANT_RETENTION_WINDOW_MS;
}

/** Whole days remaining until the retention window elapses (ceil, ≥ 0). */
export function retentionDaysRemaining(
  tenant: TenantLifecycleState,
  now: number,
): number {
  const eligibleAt = tenant.purgeEligibleAt;
  if (eligibleAt === undefined) return 0;
  const remaining = eligibleAt - now;
  return Math.max(0, Math.ceil(remaining / (24 * 60 * 60 * 1000)));
}

/**
 * Open the retention window. Allowed from trial / active / suspended only;
 * a tenant already pending deletion or offboarded may not re-enter.
 */
export function assertCanRequestDeletion(
  tenant: TenantLifecycleState,
): void {
  if (tenant.deletedAt !== undefined) {
    throw new Error("Tenant is already offboarded");
  }
  if (tenant.status === "pending_deletion") {
    throw new Error("Deletion is already in progress for this tenant");
  }
  if (tenant.status === "cancelled") {
    throw new Error("Cancelled tenants can only be offboarded via the retention workflow");
  }
}

/**
 * Reinstate a tenant. Only a suspended or pending-deletion tenant may be
 * restored to the active estate; cancelled/offboarded tenants are terminal.
 */
export function assertCanRestore(tenant: TenantLifecycleState): void {
  if (tenant.deletedAt !== undefined) {
    throw new Error("Tenant is already offboarded");
  }
  if (tenant.status === "cancelled") {
    throw new Error("Cancelled tenants cannot be restored");
  }
  if (tenant.status !== "suspended" && tenant.status !== "pending_deletion") {
    throw new Error("Tenant is not in a restorable state");
  }
}

/**
 * Finalize a pending-deletion tenant (super-admin only). The hard guard this
 * module exists for: a purge attempt before the retention window has elapsed
 * (or without a deletion request at all) is a hard denial.
 */
export function assertCanPurge(tenant: TenantLifecycleState, now: number): void {
  if (tenant.deletedAt !== undefined) {
    throw new Error("Tenant is already offboarded");
  }
  if (tenant.status !== "pending_deletion") {
    throw new Error("Only tenants pending deletion can be purged");
  }
  const eligibleAt = tenant.purgeEligibleAt;
  if (eligibleAt === undefined) {
    throw new Error("Tenant has no purge window; deletion was not requested");
  }
  if (now < eligibleAt) {
    const days = retentionDaysRemaining(tenant, now);
    throw new Error(
      `Retention window not elapsed: ${days} day(s) remaining until entitlement`,
    );
  }
}