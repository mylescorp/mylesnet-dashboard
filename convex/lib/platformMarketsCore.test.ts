import { test } from "node:test";
import assert from "node:assert/strict";
import { assertMarketBelongsToTenant, assertNoActiveMarketAssignments, normalizeMarketInput } from "./platformMarketsCore.ts";

const tenantA = "tenants:a" as never;
const tenantB = "tenants:b" as never;

test("market input is normalized and validates required fields and ISO currency shape", () => {
  assert.deepEqual(normalizeMarketInput({ name: "  Kisumu  ", country: " Kenya ", currency: "kes" }), { name: "Kisumu", country: "Kenya", currency: "KES" });
  assert.throws(() => normalizeMarketInput({ name: " ", country: "Kenya", currency: "KES" }), /name and country/);
  assert.throws(() => normalizeMarketInput({ name: "Nairobi", country: "Kenya", currency: "KESX" }), /three-letter ISO/);
});

test("a platform market operation accepts only the selected tenant's market", () => {
  assert.doesNotThrow(() => assertMarketBelongsToTenant({ tenantId: tenantA }, tenantA));
  assert.throws(() => assertMarketBelongsToTenant({ tenantId: tenantB }, tenantA), /not found for this tenant/);
  assert.throws(() => assertMarketBelongsToTenant(null, tenantA), /not found for this tenant/);
});

test("market archive refuses active assignments and permits an unassigned market", () => {
  assert.doesNotThrow(() => assertNoActiveMarketAssignments(0));
  assert.throws(() => assertNoActiveMarketAssignments(2), /2 active assignment/);
});
