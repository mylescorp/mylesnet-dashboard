import { test } from "node:test";
import assert from "node:assert/strict";

import {
  canDeletePlatformTenant,
  canManagePlatformPlans,
  canManagePlatformTenants,
} from "./permissions.ts";
import { PLATFORM_SUB_ROLE_MAP, SYSTEM_ROLES } from "../../../convex/lib/permissions.ts";
import {
  PLATFORM_ANALYTICS_READ_SUB_ROLES,
  PLATFORM_FINANCE_SUB_ROLES,
  PLATFORM_FLEET_READ_SUB_ROLES,
  PLATFORM_OPERATE_SUB_ROLES,
  PLATFORM_READ_SUB_ROLES,
  PLATFORM_REVENUE_READ_SUB_ROLES,
  PLATFORM_SUPER_ADMIN_SUB_ROLES,
  PLATFORM_VOUCHER_MONITOR_SUB_ROLES,
} from "../../../convex/lib/platformAccess.ts";
import { resolveAllowedRoleSlugs } from "../../../convex/lib/platformRoleCore.ts";

/**
 * Server/UI parity guard for the platform control-plane role matrix.
 *
 * Phase 0 requires the role matrix to be enforced on the server and the UI, and
 * the owner directive requires the real `PLATFORM_SUB_ROLE_MAP` with every
 * spec-silent cell denied. The gate lists are imported from the canonical
 * `convex/lib/platformAccess.ts` that the Convex gates themselves consume, so a
 * change to a backend gate flows into this guard instead of silently escaping a
 * copied matrix. Each list is resolved through the same map the Convex gates use,
 * then the panel visibility helpers (`apps/web/platform/permissions.ts`) are
 * asserted to agree for every concrete platform system role. A role the matrix
 * does not name is denied on both sides.
 */

const PLATFORM_ROLE_SLUGS = SYSTEM_ROLES.filter((role) => role.isPlatform).map((role) => role.slug);

function assertUiMatchesGate(
  label: string,
  uiDecision: (roleSlugs: readonly string[] | undefined) => boolean,
  gateSubRoles: string[],
) {
  const allowed = resolveAllowedRoleSlugs(gateSubRoles, PLATFORM_SUB_ROLE_MAP);
  for (const slug of PLATFORM_ROLE_SLUGS) {
    assert.equal(
      uiDecision([slug]),
      allowed.includes(slug),
      `${label}: the UI ${allowed.includes(slug) ? "hides" : "shows"} the action for ${slug} but the backend gate disagrees`,
    );
  }
}

test("tenant lifecycle and provisioning UI matches the canonical operate gate", () => {
  assertUiMatchesGate("tenant operate", canManagePlatformTenants, PLATFORM_OPERATE_SUB_ROLES);
});

test("plan management UI matches the canonical finance gate", () => {
  assertUiMatchesGate("plan manage", canManagePlatformPlans, PLATFORM_FINANCE_SUB_ROLES);
});

test("tenant cancellation UI matches the canonical super-admin gate", () => {
  assertUiMatchesGate("tenant cancel", canDeletePlatformTenant, PLATFORM_SUPER_ADMIN_SUB_ROLES);
});

test("read-only and support roles are denied every platform write action", () => {
  for (const slug of ["platform_readonly", "platform_support"]) {
    assert.equal(canManagePlatformTenants([slug]), false, `${slug} must not manage tenants`);
    assert.equal(canManagePlatformPlans([slug]), false, `${slug} must not manage plans`);
    assert.equal(canDeletePlatformTenant([slug]), false, `${slug} must not cancel tenants`);
  }
});

test("finance can manage plans but cannot operate tenants or cancel them", () => {
  assert.equal(canManagePlatformPlans(["finance_manager"]), true);
  assert.equal(canManagePlatformTenants(["finance_manager"]), false);
  assert.equal(canDeletePlatformTenant(["finance_manager"]), false);
});

test("ops can operate tenants but cannot manage plans or cancel them", () => {
  assert.equal(canManagePlatformTenants(["ops_manager"]), true);
  assert.equal(canManagePlatformPlans(["ops_manager"]), false);
  assert.equal(canDeletePlatformTenant(["ops_manager"]), false);
});

test("the visibility helpers fail closed when no roles are supplied", () => {
  assert.equal(canManagePlatformTenants(undefined), false);
  assert.equal(canManagePlatformPlans(undefined), false);
  assert.equal(canDeletePlatformTenant(undefined), false);
});

test("every canonical gate resolves to a platform system role", () => {
  const gates = [
    PLATFORM_READ_SUB_ROLES,
    PLATFORM_OPERATE_SUB_ROLES,
    PLATFORM_FINANCE_SUB_ROLES,
    PLATFORM_REVENUE_READ_SUB_ROLES,
    PLATFORM_VOUCHER_MONITOR_SUB_ROLES,
    PLATFORM_FLEET_READ_SUB_ROLES,
    PLATFORM_ANALYTICS_READ_SUB_ROLES,
    PLATFORM_SUPER_ADMIN_SUB_ROLES,
  ];
  for (const gate of gates) {
    for (const slug of resolveAllowedRoleSlugs(gate, PLATFORM_SUB_ROLE_MAP)) {
      assert.ok(
        PLATFORM_ROLE_SLUGS.includes(slug),
        `a canonical gate resolves to ${slug}, which is not a platform system role`,
      );
    }
  }
});
