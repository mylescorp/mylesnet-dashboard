import { test } from "node:test";
import assert from "node:assert/strict";
import { hasAnyPlatformSubRole } from "./platformSubRoles.ts";

test("UI role checks expand the same concrete role aliases as Convex guards", () => {
  assert.equal(hasAnyPlatformSubRole(["platform_owner"], ["platform_super_admin"]), true);
  assert.equal(hasAnyPlatformSubRole(["platform_admin"], ["platform_super_admin"]), true);
  assert.equal(hasAnyPlatformSubRole(["finance_manager"], ["platform_finance"]), true);
  assert.equal(hasAnyPlatformSubRole(["ops_manager"], ["platform_ops"]), true);
  assert.equal(hasAnyPlatformSubRole(["platform_readonly"], ["platform_finance"]), false);
});
