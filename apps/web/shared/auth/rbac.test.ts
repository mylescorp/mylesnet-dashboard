import { test } from "node:test";
import assert from "node:assert/strict";
import {
  flattenOrgScopedRoles,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
  isPlatformStaff,
  isPlatformSuperAdmin,
  panelForRole,
  roleMatchesPanel,
  toClaimArray,
  normalizeRoleClaims,
} from "./rbac.ts";
import {
  canDeletePlatformTenant,
  canManagePlatformInfrastructure,
  canManagePlatformPlans,
  canManagePlatformTenants,
  canManagePlatformWhiteLabel,
  canManagePlatformPartnerRegistry,
  canReadPlatformPartnerRegistry,
} from "../../platform/permissions.ts";

test("panelForRole maps role slugs to canonical panels", () => {
  assert.equal(panelForRole("platform_owner"), "platform");
  assert.equal(panelForRole("org-platform_owner"), "platform");
  assert.equal(panelForRole("platform_admin"), "platform");
  assert.equal(panelForRole("network_operator"), "network");
  assert.equal(panelForRole("agent"), "dashboard");
  assert.equal(panelForRole("reseller_manager"), "reseller");
  assert.equal(panelForRole("agency_admin"), "agency");
  assert.equal(panelForRole("partner_ops"), "partner");
  assert.equal(panelForRole("unknown_role"), null);
});

test("roleMatchesPanel is true when any held role maps to the panel", () => {
  assert.equal(roleMatchesPanel(["agent", "network_operator"], "network"), true);
  assert.equal(roleMatchesPanel(["agent"], "dashboard"), true);
  assert.equal(roleMatchesPanel(["agent"], "network"), false);
});

test("hasRole / hasAnyRole implement all-vs-any semantics", () => {
  assert.equal(hasRole(["platform_owner", "platform_admin"], ["platform_admin"]), true);
  assert.equal(hasRole(["platform_owner"], ["platform_admin"]), false);
  assert.equal(hasRole(["platform_owner"], []), true);
  assert.equal(hasAnyRole(["agent"], ["platform_owner", "agent"]), true);
  assert.equal(hasAnyRole(["agent"], ["platform_owner"]), false);
  assert.equal(hasAnyRole(["org-platform_owner"], ["platform_super_admin", "platform_owner"]), true);
  assert.equal(hasRole(["org-platform_owner"], ["platform_owner"]), true);
  assert.equal(hasAnyRole(["agent"], []), true);
});

test("hasPermission / hasAnyPermission implement all-vs-any semantics", () => {
  assert.equal(hasPermission(["dashboard:access", "routers:read"], ["dashboard:access", "routers:read"]), true);
  assert.equal(hasPermission(["dashboard:access"], ["dashboard:access", "routers:read"]), false);
  assert.equal(hasPermission(["dashboard:access"], []), true);
  assert.equal(hasAnyPermission(["routers:read"], ["dashboard:access", "routers:read"]), true);
  assert.equal(hasAnyPermission(["other"], ["dashboard:access"]), false);
});

test("toClaimArray normalizes single values and arrays", () => {
  assert.deepEqual(toClaimArray("platform_owner"), ["platform_owner"]);
  assert.deepEqual(toClaimArray(["a", "b"]), ["a", "b"]);
  assert.deepEqual(toClaimArray(["a", 1, null, "b"]), ["a", "b"]);
  assert.deepEqual(toClaimArray(undefined), []);
  assert.deepEqual(toClaimArray(null), []);
  assert.deepEqual(toClaimArray({} as unknown), []);
});

test("normalizeRoleClaims supports singular and plural AuthKit role claims", () => {
  assert.deepEqual(normalizeRoleClaims("platform_owner", undefined), ["platform_owner"]);
  assert.deepEqual(normalizeRoleClaims(undefined, ["tenant_admin"]), ["tenant_admin"]);
  assert.deepEqual(normalizeRoleClaims("platform_owner", ["platform_owner", "platform_admin"]), ["platform_owner", "platform_admin"]);
  assert.deepEqual(normalizeRoleClaims(undefined, { org_1: ["org-platform_owner"] }), ["org-platform_owner"]);
});

test("flattenOrgScopedRoles handles org-scoped role claims", () => {
  assert.deepEqual(flattenOrgScopedRoles({ org_1: ["plat_owner"] }), ["plat_owner"]);
  assert.deepEqual(flattenOrgScopedRoles({ org_1: ["a", "b"], org_2: ["c"] }), ["a", "b", "c"]);
  assert.deepEqual(flattenOrgScopedRoles(["flat"]), ["flat"]);
  assert.deepEqual(flattenOrgScopedRoles(undefined), []);
});

test("isPlatformStaff flags platform staff roles", () => {
  assert.equal(isPlatformStaff(["platform_owner"]), true);
  assert.equal(isPlatformStaff(["org-platform_owner"]), true);
  assert.equal(isPlatformStaff(["platform_admin", "agent"]), true);
  assert.equal(isPlatformStaff(["agent"]), false);
  assert.equal(isPlatformStaff([]), false);
});

test("platform access management follows super-admin sub-role, including org alias", () => {
  assert.equal(isPlatformSuperAdmin(["platform_owner"]), true);
  assert.equal(isPlatformSuperAdmin(["platform_admin"]), true);
  assert.equal(isPlatformSuperAdmin(["org-platform_owner"]), true);
  assert.equal(isPlatformSuperAdmin(["platform_finance"]), false);
  assert.equal(isPlatformSuperAdmin(["ops_manager"]), false);
  assert.equal(isPlatformSuperAdmin(["platform_support"]), false);
  assert.equal(isPlatformSuperAdmin(["platform_readonly"]), false);
});

test("platform UI write controls match the tenant, finance, infrastructure, and white-label role matrices", () => {
  const allowed = (check: (roles: string[]) => boolean, yes: string[], no: string[]) => {
    for (const role of yes) assert.equal(check([role]), true, `${role} should be allowed`);
    for (const role of no) assert.equal(check([role]), false, `${role} should be denied`);
  };
  allowed(canManagePlatformTenants, ["platform_owner", "platform_admin", "ops_manager", "org-platform_owner", "org-platform_admin"], ["finance_manager", "platform_support", "platform_readonly"]);
  allowed(canDeletePlatformTenant, ["platform_owner", "platform_admin", "org-platform_owner", "org-platform_admin"], ["ops_manager", "finance_manager", "platform_support", "platform_readonly"]);
  allowed(canManagePlatformPlans, ["platform_owner", "platform_admin", "finance_manager", "org-platform_owner", "org-platform_admin"], ["ops_manager", "platform_support", "platform_readonly"]);
  allowed(canManagePlatformInfrastructure, ["platform_owner", "platform_admin", "ops_manager", "org-platform_owner", "org-platform_admin"], ["finance_manager", "platform_support", "platform_readonly"]);
  allowed(canManagePlatformWhiteLabel, ["platform_owner", "platform_admin", "org-platform_owner", "org-platform_admin"], ["ops_manager", "finance_manager", "platform_support", "platform_readonly"]);
});

test("agency and reseller registry UI matches the D1 read and write matrix", () => {
  const allowed = (check: (roles: readonly string[] | undefined) => boolean, yes: string[], no: string[]) => {
    for (const role of yes) assert.equal(check([role]), true, `${role} should be allowed`);
    for (const role of no) assert.equal(check([role]), false, `${role} should be denied`);
  };
  allowed(canReadPlatformPartnerRegistry, ["platform_owner", "platform_ops", "ops_manager", "platform_finance", "finance_manager", "platform_support"], ["platform_readonly", "readonly", "tenant_admin"]);
  allowed(canManagePlatformPartnerRegistry, ["platform_owner", "platform_admin", "org-platform_owner", "org-platform_admin"], ["platform_ops", "platform_finance", "platform_support", "platform_readonly"]);
});
