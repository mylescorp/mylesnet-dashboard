import test from "node:test";
import assert from "node:assert/strict";
import { normalizePaymentIdempotencyKey } from "./paymentIdempotencyCore.ts";

test("trims surrounding whitespace from gateway and reference", () => {
  assert.deepEqual(
    normalizePaymentIdempotencyKey({ gateway: "  mobile_money ", reference: " PAY-1 " }),
    { gateway: "mobile_money", reference: "PAY-1" },
  );
});

test("leaves an already canonical key unchanged", () => {
  const key = { gateway: "mobile_money", reference: "PAY-1700000000000" };
  assert.deepEqual(normalizePaymentIdempotencyKey(key), key);
});

test("keeps distinct references distinct", () => {
  const a = normalizePaymentIdempotencyKey({ gateway: "mobile_money", reference: "PAY-1" });
  const b = normalizePaymentIdempotencyKey({ gateway: "mobile_money", reference: "PAY-2" });
  assert.notDeepEqual(a, b);
});

test("does not merge references that differ only inside the value", () => {
  const a = normalizePaymentIdempotencyKey({ gateway: "mobile_money", reference: "PAY 1" });
  const b = normalizePaymentIdempotencyKey({ gateway: "mobile_money", reference: "PAY  1" });
  assert.notDeepEqual(a, b);
});
