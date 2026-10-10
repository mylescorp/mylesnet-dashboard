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

test("commission ledger reads allow super-admin, finance, and ops only", () => {
  const readers = resolveAllowedRoleSlugs(
    ["platform_super_admin", "platform_finance", "platform_ops"],
    PLATFORM_SUB_ROLE_MAP,
  );
  assert.equal(hasAllowedRole(["platform_owner"], readers), true);
  assert.equal(hasAllowedRole(["finance_manager"], readers), true);
  assert.equal(hasAllowedRole(["ops_manager"], readers), true);
  assert.equal(hasAllowedRole(["platform_support"], readers), false);
  assert.equal(hasAllowedRole(["platform_readonly"], readers), false);
});

test("E3 commission rate CRUD is limited to super-admin and finance roles", () => {
  const readers = resolveAllowedRoleSlugs(["platform_super_admin", "platform_finance"], PLATFORM_SUB_ROLE_MAP);
  for (const role of ["platform_owner", "platform_admin", "finance_manager"]) {
    assert.equal(hasAllowedRole([role], readers), true, `${role} should manage commission rates`);
  }
  for (const role of ["ops_manager", "platform_support", "platform_readonly"]) {
    assert.equal(hasAllowedRole([role], readers), false, `${role} must not manage commission rates`);
  }
});

test("C6 billing anomaly review is SA/ops RU while finance is read-only", () => {
  const readers = resolveAllowedRoleSlugs(["platform_super_admin", "platform_finance", "platform_ops"], PLATFORM_SUB_ROLE_MAP);
  const reviewers = resolveAllowedRoleSlugs(["platform_super_admin", "platform_ops"], PLATFORM_SUB_ROLE_MAP);
  for (const role of ["platform_owner", "platform_admin", "finance_manager", "ops_manager"]) assert.equal(hasAllowedRole([role], readers), true);
  for (const role of ["platform_owner", "platform_admin", "ops_manager"]) assert.equal(hasAllowedRole([role], reviewers), true);
  assert.equal(hasAllowedRole(["finance_manager"], reviewers), false);
  assert.equal(hasAllowedRole(["platform_support"], readers), false);
  assert.equal(hasAllowedRole(["platform_readonly"], readers), false);
});

test("platform API key management allows SA writes and OPS reads, while denying FIN", () => {
  const readers = resolveAllowedRoleSlugs(["platform_super_admin", "platform_ops"], PLATFORM_SUB_ROLE_MAP);
  const writers = resolveAllowedRoleSlugs(["platform_super_admin"], PLATFORM_SUB_ROLE_MAP);
  assert.equal(hasAllowedRole(["platform_owner"], writers), true);
  assert.equal(hasAllowedRole(["ops_manager"], readers), true);
  assert.equal(hasAllowedRole(["ops_manager"], writers), false);
  assert.equal(hasAllowedRole(["finance_manager"], readers), false);
  assert.equal(hasAllowedRole(["platform_support"], readers), false);
});

test("RADIUS fleet reads allow all sub-roles and writes allow only super-admin and ops", () => {
  const readers = resolveAllowedRoleSlugs(["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"], PLATFORM_SUB_ROLE_MAP);
  const writers = resolveAllowedRoleSlugs(["platform_super_admin", "platform_ops"], PLATFORM_SUB_ROLE_MAP);
  for (const role of ["platform_owner", "platform_admin", "ops_manager", "finance_manager", "platform_support", "platform_readonly"]) {
    assert.equal(hasAllowedRole([role], readers), true, `${role} should read`);
  }
  for (const role of ["platform_owner", "platform_admin", "ops_manager"]) assert.equal(hasAllowedRole([role], writers), true, `${role} should write`);
  for (const role of ["finance_manager", "platform_support", "platform_readonly"]) assert.equal(hasAllowedRole([role], writers), false, `${role} must not write`);
});

test("agency and reseller oversight is readable by all sub-roles and writable only by super-admin", () => {
  const readers = resolveAllowedRoleSlugs(
    ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"],
    PLATFORM_SUB_ROLE_MAP,
  );
  const writers = resolveAllowedRoleSlugs(["platform_super_admin"], PLATFORM_SUB_ROLE_MAP);
  for (const role of ["platform_owner", "platform_admin", "ops_manager", "finance_manager", "platform_support", "platform_readonly"]) {
    assert.equal(hasAllowedRole([role], readers), true, `${role} should read partner registries`);
  }
  for (const role of ["platform_owner", "platform_admin"]) assert.equal(hasAllowedRole([role], writers), true, `${role} should manage partner links`);
  for (const role of ["ops_manager", "finance_manager", "platform_support", "platform_readonly"]) {
    assert.equal(hasAllowedRole([role], writers), false, `${role} must not manage partner links`);
  }
});

test("tenant leaderboard reads allow only super-admin and readonly roles", () => {
  const readers = resolveAllowedRoleSlugs(["platform_super_admin", "platform_readonly"], PLATFORM_SUB_ROLE_MAP);
  for (const role of ["platform_owner", "platform_admin", "platform_readonly"]) {
    assert.equal(hasAllowedRole([role], readers), true, `${role} should read tenant rankings`);
  }
  for (const role of ["ops_manager", "finance_manager", "platform_support"]) {
    assert.equal(hasAllowedRole([role], readers), false, `${role} must not read tenant rankings`);
  }
});

test("unknown sub-role names remain literal role slugs and duplicate mappings are removed", () => {
  assert.deepEqual(
    resolveAllowedRoleSlugs(["platform_ops", "ops_manager", "custom_role"], PLATFORM_SUB_ROLE_MAP),
    ["ops_manager", "custom_role"],
  );
});
