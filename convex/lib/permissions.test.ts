import { test } from "node:test";
import assert from "node:assert/strict";
import {
  TENANT_ROLE_PERMISSIONS,
  tenantRoleHasPermission,
  ALL_PERMISSION_SLUGS,
} from "./permissions.ts";

test("tenant admins and members can read their own tenant audit log", () => {
  assert.equal(tenantRoleHasPermission("tenant_admin", "audit_log:read"), true);
  assert.equal(tenantRoleHasPermission("member", "audit_log:read"), true);
});

test("platform control-plane permissions stay excluded from tenant roles", () => {
  for (const role of ["tenant_admin", "member"]) {
    assert.equal(tenantRoleHasPermission(role, "roles:manage"), false);
    assert.equal(tenantRoleHasPermission(role, "users:manage"), false);
    assert.equal(tenantRoleHasPermission(role, "organizations:read"), false);
    assert.equal(tenantRoleHasPermission(role, "investors:manage"), false);
  }
});

test("every tenant role permission is drawn from the canonical catalogue", () => {
  const catalogue = new Set(ALL_PERMISSION_SLUGS);
  for (const [role, permissions] of Object.entries(TENANT_ROLE_PERMISSIONS)) {
    for (const permission of permissions) {
      assert.ok(catalogue.has(permission), `${role} references unknown permission ${permission}`);
    }
  }
});

test("an unknown tenant role grants nothing", () => {
  assert.equal(tenantRoleHasPermission("not_a_role", "dashboard:access"), false);
  assert.equal(tenantRoleHasPermission(undefined, "dashboard:access"), false);
});
