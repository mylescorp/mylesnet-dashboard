import { test } from "node:test";
import assert from "node:assert/strict";
import { assertCommissionCanBeDisputed } from "./commissionDisputeCore.ts";

test("paid or already disputed commissions cannot be disputed again", () => {
  assert.throws(() => assertCommissionCanBeDisputed("paid"), /cannot be disputed/);
  assert.throws(() => assertCommissionCanBeDisputed("disputed"), /cannot be disputed/);
});

test("unpaid commissions remain eligible for a dispute", () => {
  assert.doesNotThrow(() => assertCommissionCanBeDisputed("held"));
  assert.doesNotThrow(() => assertCommissionCanBeDisputed("requested"));
  assert.doesNotThrow(() => assertCommissionCanBeDisputed("processing"));
});
