import { test } from "node:test";
import assert from "node:assert/strict";
import {
  flattenOrgScopedRoles,
  hasAnyPermission,
  hasAnyRole,
  hasPermission,
  hasRole,
  isPlatformStaff,
  panelForRole,
  roleMatchesPanel,
  toClaimArray,
} from "./rbac.ts";

test("panelForRole maps role slugs to canonical panels", () => {
  assert.equal(panelForRole("platform_owner"), "platform");
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

test("flattenOrgScopedRoles handles org-scoped role claims", () => {
  assert.deepEqual(flattenOrgScopedRoles({ org_1: ["plat_owner"] }), ["plat_owner"]);
  assert.deepEqual(flattenOrgScopedRoles({ org_1: ["a", "b"], org_2: ["c"] }), ["a", "b", "c"]);
  assert.deepEqual(flattenOrgScopedRoles(["flat"]), ["flat"]);
  assert.deepEqual(flattenOrgScopedRoles(undefined), []);
});

test("isPlatformStaff flags platform staff roles", () => {
  assert.equal(isPlatformStaff(["platform_owner"]), true);
  assert.equal(isPlatformStaff(["platform_admin", "agent"]), true);
  assert.equal(isPlatformStaff(["agent"]), false);
  assert.equal(isPlatformStaff([]), false);
});