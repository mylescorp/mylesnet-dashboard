/**
 * Cross-tenant isolation test core (X-TEN §B14, §B19; X-LAB). Cross-tenant
 * denial is a RELEASE GATE. Pure decision logic here is exercised by
 * node:test; the Convex-wired suite (real tenants, real memberships) is a
 * tracked Phase 1 step that activates once the bootstrap tenant + backfill
 * land.
 */

export type IsolationScenario =
  | "unauthenticated"
  | "wrong-role"
  | "cross-tenant"
  | "client-override"
  | "suspended-tenant"
  | "soft-deleted-resource";

export interface IsolationExpectation {
  scenario: IsolationScenario;
  /** Expected decision for the canonical denial test of this scenario. */
  allowed: boolean;
  /** Reason fragment the assertion should match on. */
  reasonFragment: string;
}

/**
 * The canonical cross-tenant denial catalogue. Every scenario here must be
 * enforced by the Phase 1 tenant guards; the Convex integration suite asserts
 * each one against live data (stubbed in `tenantIsolationCore.test.ts` now).
 */
export const DENIAL_CATALOGUE: readonly IsolationExpectation[] = [
  { scenario: "unauthenticated", allowed: false, reasonFragment: "unauthenticated" },
  { scenario: "wrong-role", allowed: false, reasonFragment: "role" },
  { scenario: "cross-tenant", allowed: false, reasonFragment: "cross-tenant" },
  { scenario: "client-override", allowed: false, reasonFragment: "not authority" },
  { scenario: "suspended-tenant", allowed: false, reasonFragment: "suspended" },
  { scenario: "soft-deleted-resource", allowed: false, reasonFragment: "deleted" },
];

/** Canonical denial for a pair of tenant ids. Cross-tenant is always denied. */
export function denialReasonForTenantPair(
  actorTenantId: string | null,
  resourceTenantId: string | null | undefined,
): string | null {
  if (resourceTenantId === null || resourceTenantId === undefined) return null; // global
  if (!actorTenantId) return "cross-tenant: actor has no tenant scope";
  if (actorTenantId !== resourceTenantId) return "cross-tenant: tenant mismatch";
  return null;
}

/**
 * Assert a catalogue scenario is covered by a decision. Returns the catalogue
 * entry matched by scenario; the caller compares the actual denial.
 */
export function expectationForScenario(scenario: IsolationScenario): IsolationExpectation {
  const entry = DENIAL_CATALOGUE.find((e) => e.scenario === scenario);
  if (!entry) throw new Error(`Unknown isolation scenario: ${scenario}`);
  return entry;
}

/** True when all catalogue scenarios are present (guards against regressions). */
export function isDenialCatalogueComplete(
  scenarios: readonly IsolationScenario[],
): boolean {
  const expected = new Set(DENIAL_CATALOGUE.map((e) => e.scenario));
  for (const scenario of scenarios) expected.delete(scenario);
  return expected.size === 0;
}