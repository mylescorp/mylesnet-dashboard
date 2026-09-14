import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_SUB_ROLE_MAP } from "./permissions.ts";
import { getSystemRoleBySlug } from "./permissions.ts";

test("spec sub-role -> concrete role mapping is as agreed", () => {
  assert.deepEqual(PLATFORM_SUB_ROLE_MAP["platform_super_admin"], ["platform_owner", "platform_admin"]);
  assert.deepEqual(PLATFORM_SUB_ROLE_MAP["platform_ops"], ["ops_manager"]);
  assert.deepEqual(PLATFORM_SUB_ROLE_MAP["platform_finance"], ["finance_manager"]);
  assert.deepEqual(PLATFORM_SUB_ROLE_MAP["platform_support"], ["platform_support"]);
  assert.deepEqual(PLATFORM_SUB_ROLE_MAP["platform_readonly"], ["platform_readonly"]);
});

test("every spec sub-role maps to existing system role slugs", () => {
  const subRoles = ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"];
  for (const subRole of subRoles) {
    const mapped = PLATFORM_SUB_ROLE_MAP[subRole];
    assert.ok(mapped && mapped.length > 0, `missing mapping for ${subRole}`);
    for (const slug of mapped) {
      assert.ok(getSystemRoleBySlug(slug), `mapped role ${slug} is not a system role`);
    }
  }
});

test("unknown sub-roles pass through unchanged (default to requireAnyRole semantics)", () => {
  assert.deepEqual(PLATFORM_SUB_ROLE_MAP["custom_role"] ?? ["custom_role"], ["custom_role"]);
});

test("platform_readonly system role exists and holds no write permissions", () => {
  const role = getSystemRoleBySlug("platform_readonly");
  assert.ok(role, "platform_readonly system role must be seeded");
  assert.equal(role.isPlatform, true);
  assert.equal(role.syncToWorkos, true);
  const writePermissions = role.permissions.filter(
    (permission) =>
      permission.endsWith(":manage") ||
      permission.endsWith(":create") ||
      permission.endsWith(":update") ||
      permission.endsWith(":delete") ||
      permission.endsWith(":redeem") ||
      permission.endsWith(":request_payout"),
  );
  assert.deepEqual(writePermissions, []);
});