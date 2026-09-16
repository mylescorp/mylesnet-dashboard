/**
 * Pure tenant-scope guard logic for Phase 1 (X-TEN §B1, §B5). Kept free of
 * Convex imports so `npm test` can exercise it with plain node:test (mirrors
 * migrationRunCore.ts). The Convex wrappers in
 * `./tenant.ts` use these to enforce server-derived tenancy — client-supplied
 * tenant ids are never authority.
 */

/** Lifecycle of a tenant on the shared backend. */
export type TenantStatus =
  | "trial"
  | "active"
  | "suspended"
  | "cancelled";

/**
 * Choose the only safe result from the server-derived resolution paths.
 * An unknown WorkOS organization and a missing bootstrap tenant mean the
 * caller has no tenancy; callers must deny rather than select another tenant.
 */
export function resolvedTenantOrNull<T>(
  organizationTenant: T | null | undefined,
  bootstrapTenant: T | null | undefined,
): T | null {
  return organizationTenant ?? bootstrapTenant ?? null;
}

/** Translate a WorkOS organization-membership state into local tenant scope. */
export function tenantMembershipStatusFromWorkos(
  status: "active" | "inactive" | "pending",
): "active" | "pending" | "revoked" {
  if (status === "active") return "active";
  if (status === "pending") return "pending";
  return "revoked";
}

export interface BootstrapOwnerCandidate {
  _id: string;
  platformRole?: string | null;
  deletedAt?: number;
  isActive?: boolean;
}

/**
 * Find a confirmed active owner before any bootstrap tenant is created.
 * A supplied user id is accepted only for an active, non-deleted user.
 */
export function selectBootstrapOwner<T extends BootstrapOwnerCandidate>(
  users: readonly T[],
  requestedUserId?: string,
): T | null {
  const active = (user: T) => user.deletedAt === undefined && user.isActive !== false;
  if (requestedUserId) return users.find((user) => user._id === requestedUserId && active(user)) ?? null;
  return (
    users.find((user) => active(user) && user.platformRole === "platform_owner") ??
    users.find(active) ??
    null
  );
}

/**
 * True when the tenant is in "trial" or "active" — the only states in which
 * tenant-owned work may proceed.
 */
export function isTenantActive(status: TenantStatus | undefined): boolean {
  return status === "trial" || status === "active";
}

/**
 * Write/read gate for a tenant by lifecycle status. Unlike `isTenantActive`,
 * an unset status (pre-backfill rows) defaults to allowed so the additive
 * migration never cuts off legacy behavior; only an explicit suspension or
 * cancellation blocks tenant-owned work.
 */
export function canTenantOperate(status: TenantStatus | undefined): boolean {
  return status !== "suspended" && status !== "cancelled";
}

/**
 * A suspended tenant must be denied write/read automation (exception paths
 * like finance reconciliation or emergency disable are opt-in later).
 */
export function isTenantSuspended(status: TenantStatus | undefined): boolean {
  return status === "suspended";
}

/**
 * Assert the caller may act within a tenant scope. `resolvedTenantId` comes
 * only from the server-side resolver; `clientSuppliedTenantId` is whatever the
 * caller passed. A mismatch is a hard denial — the client value may never widen
 * or redirect the resolved scope.
 */
export function assertNoClientOverride(
  resolvedTenantId: string | null | undefined,
  clientSuppliedTenantId: string | null | undefined,
  resourceLabel: string,
): void {
  if (!resolvedTenantId) return; // tenancy not established for this actor yet
  if (
    clientSuppliedTenantId !== undefined &&
    clientSuppliedTenantId !== null &&
    clientSuppliedTenantId !== resolvedTenantId
  ) {
    throw new Error(
      `Tenant scope mismatch for ${resourceLabel}: client-supplied tenantId is not authority`,
    );
  }
}

/**
 * Cross-tenant denial core. When the resource is tenant-scoped it must be
 * owned by the actor's tenant; a tenant-scoped resource with no resolvable
 * actor tenancy is denied (never assigned silently).
 */
export function assertTenantMatch(
  actorTenantId: string | null | undefined,
  resourceTenantId: string | null | undefined,
  resourceLabel: string,
): void {
  if (resourceTenantId === null || resourceTenantId === undefined) return; // global/platform object
  if (!actorTenantId) {
    throw new Error(`Cross-tenant denial for ${resourceLabel}: actor has no tenant scope`);
  }
  if (actorTenantId !== resourceTenantId) {
    throw new Error(`Cross-tenant denial for ${resourceLabel}: actor tenant does not own resource`);
  }
}

/** True exactly when the client value would override the resolved one. */
export function isClientTenantOverride(
  resolvedTenantId: string | null | undefined,
  clientTenantId: string | null | undefined,
): boolean {
  if (!resolvedTenantId) return false;
  return (
    clientTenantId !== undefined &&
    clientTenantId !== null &&
    clientTenantId !== resolvedTenantId
  );
}

/**
 * Decision model for tenant access checks — a pure, testable answer the Convex
 * layer can render into a typed denial reason without stringly error parsing.
 */
export interface TenantAccessDecision {
  allowed: boolean;
  reason: string;
}

export function decideTenantAccess(
  actorTenantId: string | null | undefined,
  resourceTenantId: string | null | undefined,
  isSuspended: boolean,
): TenantAccessDecision {
  if (isSuspended) {
    return { allowed: false, reason: "tenant suspended" };
  }
  if (resourceTenantId === null || resourceTenantId === undefined) {
    return { allowed: true, reason: "global or platform-scoped resource" };
  }
  if (!actorTenantId) {
    return { allowed: false, reason: "actor has no tenant scope" };
  }
  if (actorTenantId !== resourceTenantId) {
    return { allowed: false, reason: "cross-tenant access denied" };
  }
  return { allowed: true, reason: "tenant-scoped resource owned by actor tenant" };
}
