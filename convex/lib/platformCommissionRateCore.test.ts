import { test } from "node:test";
import assert from "node:assert/strict";
import { BUILT_IN_REFERRAL_DURATION_MONTHS, BUILT_IN_REFERRAL_RATE_BASIS_POINTS, resolveCommissionRatePolicy, validateCommissionRatePolicy } from "./platformCommissionRateCore.ts";

test("commission policy defaults to the approved public referral contract", () => {
  assert.deepEqual(resolveCommissionRatePolicy(undefined, undefined), { rateBasisPoints: 2000, durationMonths: 12 });
  assert.equal(BUILT_IN_REFERRAL_RATE_BASIS_POINTS, 2000);
  assert.equal(BUILT_IN_REFERRAL_DURATION_MONTHS, 12);
});

test("agency override takes precedence while absent override inherits the global policy", () => {
  const global = { rateBasisPoints: 2000, durationMonths: 12 };
  assert.deepEqual(resolveCommissionRatePolicy(global, undefined), global);
  assert.deepEqual(resolveCommissionRatePolicy(global, { rateBasisPoints: 1500, durationMonths: 6 }), { rateBasisPoints: 1500, durationMonths: 6 });
  assert.deepEqual(resolveCommissionRatePolicy(global, { rateBasisPoints: 0, durationMonths: 1 }), { rateBasisPoints: 0, durationMonths: 1 });
});

test("commission policy validation accepts bounds and rejects invalid fractions or ranges", () => {
  assert.deepEqual(validateCommissionRatePolicy(0, 1), { rateBasisPoints: 0, durationMonths: 1 });
  assert.deepEqual(validateCommissionRatePolicy(10000, 60), { rateBasisPoints: 10000, durationMonths: 60 });
  for (const [rate, months] of [[-1, 12], [10001, 12], [20.5, 12], [2000, 0], [2000, 61], [2000, 1.5]]) {
    assert.throws(() => validateCommissionRatePolicy(rate!, months!), Error);
  }
});
