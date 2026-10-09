import { test } from "node:test";
import assert from "node:assert/strict";
import { clampAnomalyWindowDays, detectBillingAnomalies } from "./platformBillingAnomalyCore.ts";

const day = 24 * 60 * 60 * 1000;
test("billing anomaly detector marks stale pending payments only after the configured threshold", () => {
  assert.deepEqual(detectBillingAnomalies({ status: "pending", amount: 100, paymentDate: 10_000, hasDuplicateReference: false }, 10_000 + day - 1), []);
  assert.deepEqual(detectBillingAnomalies({ status: "pending", amount: 100, paymentDate: 10_000, hasDuplicateReference: false }, 10_000 + day), ["stale_pending"]);
});

test("billing anomaly detector correlates duplicate references, invoice status, and negative amounts", () => {
  assert.deepEqual(detectBillingAnomalies({ status: "completed", amount: -1, paymentDate: 1, invoiceStatus: "issued", hasDuplicateReference: true }, 2), ["duplicate_reference", "invoice_status_mismatch", "negative_amount"]);
  assert.deepEqual(detectBillingAnomalies({ status: "completed", amount: 10, paymentDate: 1, invoiceStatus: "paid", hasDuplicateReference: false }, 2), []);
  assert.deepEqual(detectBillingAnomalies({ status: "completed", amount: 10, paymentDate: 1, hasDuplicateReference: false }, 2), []);
});

test("anomaly window is an integer bounded from one to 90 days", () => {
  assert.equal(clampAnomalyWindowDays(undefined), 30);
  assert.equal(clampAnomalyWindowDays(2.8), 2);
  assert.equal(clampAnomalyWindowDays(0), 1);
  assert.equal(clampAnomalyWindowDays(120), 90);
});
