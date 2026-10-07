import { test } from "node:test";
import assert from "node:assert/strict";
import { calculatePlatformRevenue } from "./platformRevenueCore.ts";

test("contracted MRR/ARR sums approved monthly KES prices for active tenants", () => {
  const result = calculatePlatformRevenue([
    { status: "active", entitlement: { planId: "starter", status: "active" } },
    { status: "active", entitlement: { planId: "Growth", status: "active" } },
    { status: "active", entitlement: { planId: "pro", status: "active" } },
  ]);
  assert.deepEqual(result, { currency: "KES", mrrMinor: 540_000, arrMinor: 6_480_000, activeTenants: 3, trialTenants: 0, suspendedTenants: 0, unpricedActiveTenants: 0 });
});

test("trials and suspended tenants do not count as contracted revenue", () => {
  const result = calculatePlatformRevenue([
    { status: "trial", entitlement: { planId: "starter", status: "trial" } },
    { status: "suspended", entitlement: { planId: "pro", status: "active" } },
    { status: "active", entitlement: { planId: "growth", status: "trial" } },
  ]);
  assert.equal(result.mrrMinor, 0);
  assert.equal(result.trialTenants, 2);
  assert.equal(result.suspendedTenants, 1);
});

test("unknown active plan IDs remain visible as unpriced instead of inventing a value", () => {
  const result = calculatePlatformRevenue([{ status: "active", entitlement: { planId: "enterprise-custom", status: "active" } }]);
  assert.equal(result.activeTenants, 1);
  assert.equal(result.unpricedActiveTenants, 1);
  assert.equal(result.mrrMinor, 0);
});
