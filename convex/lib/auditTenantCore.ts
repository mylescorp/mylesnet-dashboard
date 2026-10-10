/**
 * Pure tenant-attribution logic for the unified audit writer. Kept free of
 * Convex imports so `node --test` can pin the decision exactly (mirrors
 * `tenantCore.ts` and `tenantIsolationCore.ts`).
 *
 * Tenant scope rules (X-TEN):
 * - An explicit `tenantId` from the caller always wins, including an explicit
 *   `null` for a deliberate platform/global row.
 * - When the caller supplies nothing, fall back to the tenant derived from the
 *   authenticated WorkOS organization claim. An absent or unmapped claim yields
 *   no tenant scope rather than a bootstrap or arbitrary tenant.
 */
export function resolveAuditTenantId(input: {
  explicitTenantId: string | null | undefined;
  authenticatedTenantId: string | null | undefined;
}): string | null {
  if (input.explicitTenantId !== undefined) return input.explicitTenantId ?? null;
  return input.authenticatedTenantId ?? null;
}
