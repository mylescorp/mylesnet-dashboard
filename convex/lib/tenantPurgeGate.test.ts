import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAnyRoleSlug, platformSubRoleSlugs } from "./permissions.ts";

/**
 * Server-side enforcement proof for the A3 purge gate.
 *
 * `purgeTenant` gates on requirePlatformSubRole(ctx, ["platform_super_admin"])
 * and NOTHING else — platform_ops tiers can request deletion, restore or set
 * status, but can never drive a purge. These tests exercise the exact same
 * resolution and predicate helpers that the mutation runs through
 * (requireAnyRole -> hasAnyRoleSlug, requirePlatformSubRole ->
 * platformSubRoleSlugs), so a direct backend call with an ops-tier identity is
 * provably rejected before any core logic runs.
 */

const PURGE_ALLOWED = platformSubRoleSlugs(["platform_super_admin"]);

test("purge gate resolves to owner/admin slugs only", () => {
  assert.deepEqual(PURGE_ALLOWED, ["platform_owner", "platform_admin"]);
});

test("every non-super-admin tier is denied the purge gate", () => {
  const denied = [
    "ops_manager", // platform_ops
    "finance_manager", // platform_finance
    "platform_support", // platform_support
    "platform_readonly", // platform_readonly
    "member",
    "agent",
    "network_operator",
  ];
  for (const slug of denied) {
    const allowed = hasAnyRoleSlug([slug], PURGE_ALLOWED);
    assert.equal(allowed, false, `${slug} must never satisfy the purge gate`);
  }
});

test("super-admin tiers clear the purge gate", () => {
  assert.equal(hasAnyRoleSlug(["platform_owner"], PURGE_ALLOWED), true);
  assert.equal(hasAnyRoleSlug(["platform_admin"], PURGE_ALLOWED), true);
});

test("ops can drive the workflow gates but never the purge gate", () => {
  const workflowAllowed = platformSubRoleSlugs(["platform_super_admin", "platform_ops"]);
  assert.equal(hasAnyRoleSlug(["ops_manager"], workflowAllowed), true, "ops may request/restore");
  assert.equal(hasAnyRoleSlug(["ops_manager"], PURGE_ALLOWED), false, "ops may not purge");
});

test("literal system slugs and custom passthrough behave as documented", () => {
  assert.deepEqual(platformSubRoleSlugs(["platform_owner"]), ["platform_owner"]);
  assert.deepEqual(platformSubRoleSlugs(["org-custom"]), ["org-custom"]);
  assert.deepEqual(platformSubRoleSlugs([]), []);
});