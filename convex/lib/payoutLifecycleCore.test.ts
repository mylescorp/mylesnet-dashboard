import { test } from "node:test";
import assert from "node:assert/strict";
import { assertPayoutTransition } from "./payoutLifecycleCore.ts";

test("payouts follow pending approval → approved → processing → paid", () => {
  assert.doesNotThrow(() => assertPayoutTransition("pending_approval", "approved"));
  assert.doesNotThrow(() => assertPayoutTransition("approved", "processing"));
  assert.doesNotThrow(() => assertPayoutTransition("processing", "paid"));
  assert.doesNotThrow(() => assertPayoutTransition("pending_approval", "rejected"));
});

test("payouts cannot skip approval or rewrite terminal outcomes", () => {
  for (const [current, next] of [
    ["pending_approval", "processing"],
    ["pending_approval", "paid"],
    ["approved", "paid"],
    ["processing", "approved"],
    ["paid", "rejected"],
    ["rejected", "approved"],
  ] as const) {
    assert.throws(() => assertPayoutTransition(current, next), /can no longer move/);
  }
});
