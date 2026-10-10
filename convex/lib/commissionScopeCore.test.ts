import { test } from "node:test";
import assert from "node:assert/strict";
import { commissionTenantId } from "./commissionScopeCore.ts";

const valid = {
  agentTenantId: "tenant_a",
  marketTenantId: "tenant_a",
  activeAssignmentMatches: true,
};

test("commission tenant follows the assigned agent and market", () => {
  assert.equal(commissionTenantId(valid), "tenant_a");
});

test("commission accrual rejects unscoped, mismatched, unassigned, and overridden ownership", () => {
  assert.throws(() => commissionTenantId({ ...valid, agentTenantId: null }), /ownership/);
  assert.throws(() => commissionTenantId({ ...valid, marketTenantId: "tenant_b" }), /same workspace/);
  assert.throws(() => commissionTenantId({ ...valid, activeAssignmentMatches: false }), /actively assigned/);
  assert.throws(() => commissionTenantId({ ...valid, authenticatedTenantId: "tenant_b" }), /outside the active workspace/);
});
