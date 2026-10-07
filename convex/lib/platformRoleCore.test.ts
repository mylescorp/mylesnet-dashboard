import { test } from "node:test";
import assert from "node:assert/strict";
import { PLATFORM_SUB_ROLE_MAP } from "./permissions.ts";
import { hasAllowedRole, resolveAllowedRoleSlugs } from "./platformRoleCore.ts";

const marketReaders = [
  "platform_super_admin",
  "platform_ops",
  "platform_finance",
  "platform_support",
  "platform_readonly",
];
const marketWriters = ["platform_super_admin", "platform_ops"];

test("market read sub-roles resolve to their concrete system roles", () => {
  assert.deepEqual(resolveAllowedRoleSlugs(marketReaders, PLATFORM_SUB_ROLE_MAP), [
    "platform_owner",
    "platform_admin",
    "ops_manager",
    "finance_manager",
    "platform_support",
    "platform_readonly",
  ]);
});

test("market writes allow super-admin and ops roles while denying finance, support, and readonly", () => {
  const allowed = resolveAllowedRoleSlugs(marketWriters, PLATFORM_SUB_ROLE_MAP);
  assert.equal(hasAllowedRole(["platform_owner"], allowed), true);
  assert.equal(hasAllowedRole(["platform_admin"], allowed), true);
  assert.equal(hasAllowedRole(["ops_manager"], allowed), true);
  assert.equal(hasAllowedRole(["finance_manager"], allowed), false);
  assert.equal(hasAllowedRole(["platform_support"], allowed), false);
  assert.equal(hasAllowedRole(["platform_readonly"], allowed), false);
});

test("platform revenue visibility matches the C1 SA/finance/readonly matrix", () => {
  const revenueReaders = resolveAllowedRoleSlugs(
    ["platform_super_admin", "platform_finance", "platform_readonly"],
    PLATFORM_SUB_ROLE_MAP,
  );
  assert.equal(hasAllowedRole(["platform_owner"], revenueReaders), true);
  assert.equal(hasAllowedRole(["platform_admin"], revenueReaders), true);
  assert.equal(hasAllowedRole(["finance_manager"], revenueReaders), true);
  assert.equal(hasAllowedRole(["platform_readonly"], revenueReaders), true);
  assert.equal(hasAllowedRole(["ops_manager"], revenueReaders), false);
  assert.equal(hasAllowedRole(["platform_support"], revenueReaders), false);
});

test("unknown sub-role names remain literal role slugs and duplicate mappings are removed", () => {
  assert.deepEqual(
    resolveAllowedRoleSlugs(["platform_ops", "ops_manager", "custom_role"], PLATFORM_SUB_ROLE_MAP),
    ["ops_manager", "custom_role"],
  );
});
