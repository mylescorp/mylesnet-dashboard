/**
 * Cross-cutting tenant contracts (X-TEN §B2, §B16, §B18).
 *
 * Every artifact that crosses a system boundary must carry `tenantId`:
 *  - audit keys,
 *  - object-storage keys (tenant-prefixed),
 *  - queue-job envelopes,
 *  - webhook mapping (tenant-resolved; unknown → quarantine),
 *  - import/export run ids.
 *
 * Pure functions (no Convex imports) so `npm test` covers the contract
 * without a running backend. The Convex call sites wire these into their own
 * serialization as the Phase 1 read-path enforcement lands.
 */

/** Namespacing prefix used for cross-tenant artifacts that must never collide. */
export const TENANT_ARTIFACT_PREFIX = "ten";

/**
 * Audit key for a tenant-owned action. Object 0 in any global audit stream is
 * `ten.<tenantId>:<action>:<objectId>`.
 */
export function tenantAuditKey(
  tenantId: string,
  action: string,
  objectId: string,
): string {
  return `${TENANT_ARTIFACT_PREFIX}.${tenantId}:${action}:${objectId}`;
}

/**
 * Object-storage key. Stored keys are tenant-prefixed so a tenant-scoped read
 * gate can enforce isolation at the prefix boundary (S3 / Convex `_storage`
 * both accept grouped prefixes).
 */
export function tenantStorageKey(
  tenantId: string,
  category: string,
  fileName: string,
): string {
  return `${TENANT_ARTIFACT_PREFIX}/${tenantId}/${category}/${fileName}`;
}

/** Queue-job envelope — the minimum shape every worker job must carry. */
export interface TenantJobEnvelope<T = unknown> {
  tenantId: string;
  jobType: string;
  payload: T;
  createdAt: number;
}

export function tenantJobEnvelope<T>(
  tenantId: string,
  jobType: string,
  payload: T,
  now: number = Date.now(),
): TenantJobEnvelope<T> {
  return { tenantId, jobType, payload, createdAt: now };
}

/**
 * Map a provider webhook payload to a tenant id. The mapping is provider
 * contract → tenant; a payload that matches no known mapping returns null and
 * the caller quarantines it (never guessed, never dropped silently).
 */
export function webhookTenantId(
  providerValue: string | null | undefined,
  mapping: Record<string, string>,
): string | null {
  if (providerValue === null || providerValue === undefined) return null;
  return mapping[providerValue] ?? null;
}

/**
 * Import/export run id. Idempotent re-runs reuse the same id so a tracked
 * operation stays recoverable as one unit.
 */
export function tenantTransferRunId(tenantId: string, kind: "import" | "export"): string {
  return `${TENANT_ARTIFACT_PREFIX}.${tenantId}.${kind}`;
}

/**
 * Heuristic guard for tenant ids. Convex generated ids (`ten_...`) or the
 * documented namespaced forms must be non-empty and of bounded length so a
 * sloppy client value can never smuggle a wider scope.
 */
export function isValidTenantIdFormat(tenantId: string): boolean {
  return typeof tenantId === "string" && tenantId.length > 0 && tenantId.length <= 64;
}