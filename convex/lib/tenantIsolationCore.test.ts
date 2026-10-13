import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DENIAL_CATALOGUE,
  denialReasonForTenantPair,
  expectationForScenario,
  isDenialCatalogueComplete,
  readTenantFilter,
  decideTenantResourceWrite,
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

test("readTenantFilter never unscopes an enforced tenant reader", () => {
  assert.equal(readTenantFilter({ tenantId: "ten_a", enforced: true }), "ten_a");
  assert.equal(readTenantFilter({ tenantId: null, enforced: false }), null);
  assert.throws(() => readTenantFilter({ tenantId: null, enforced: true }), /no tenant id/);
});

test("decideTenantResourceWrite lets platform pass and blocks tenant cross-scope writes", () => {
  assert.equal(
    decideTenantResourceWrite({ tenantId: null, enforced: false }, "ten_b", "report"),
    null,
  );
  assert.equal(
    decideTenantResourceWrite({ tenantId: "ten_a", enforced: true }, "ten_a", "report"),
    null,
  );
  assert.match(
    decideTenantResourceWrite({ tenantId: "ten_a", enforced: true }, "ten_b", "report") ?? "",
    /another tenant/,
  );
  assert.match(
    decideTenantResourceWrite({ tenantId: "ten_a", enforced: true }, undefined, "report") ?? "",
    /not assigned/,
  );
});