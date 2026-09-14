import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DENIAL_CATALOGUE,
  denialReasonForTenantPair,
  expectationForScenario,
  isDenialCatalogueComplete,
} from "./tenantIsolationCore.ts";

test("the denial catalogue covers every required isolation scenario", () => {
  const scenarios = DENIAL_CATALOGUE.map((e) => e.scenario);
  assert.equal(isDenialCatalogueComplete(scenarios), true);
});

test("every catalogue scenario is a denial with a matching reason fragment", () => {
  for (const entry of DENIAL_CATALOGUE) {
    assert.equal(entry.allowed, false, `${entry.scenario} must be a denial`);
    assert.ok(entry.reasonFragment.length > 0);
  }
});

test("unauthenticated/wrong-role/soft-delete expectations are present", () => {
  assert.equal(expectationForScenario("unauthenticated").reasonFragment, "unauthenticated");
  assert.equal(expectationForScenario("wrong-role").reasonFragment, "role");
  assert.equal(expectationForScenario("soft-deleted-resource").reasonFragment, "deleted");
});

test("denialReasonForTenantPair denies matching cross-tenant and actorless reads", () => {
  assert.equal(denialReasonForTenantPair("ten_a", "ten_a"), null);
  assert.equal(denialReasonForTenantPair("ten_a", undefined), null);
  assert.match(denialReasonForTenantPair("ten_a", "ten_b"), /cross-tenant/);
  assert.match(denialReasonForTenantPair(null, "ten_a"), /no tenant scope/);
});

test("isDenialCatalogueComplete rejects a partial catalogue", () => {
  assert.equal(isDenialCatalogueComplete(["cross-tenant", "client-override"]), false);
  assert.equal(isDenialCatalogueComplete([]), false);
});