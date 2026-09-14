import { test } from "node:test";
import assert from "node:assert/strict";
import {
  tenantAuditKey,
  tenantStorageKey,
  tenantJobEnvelope,
  webhookTenantId,
  tenantTransferRunId,
  isValidTenantIdFormat,
} from "./tenantContracts.ts";

test("tenantAuditKey is namespaced, first-class, and ordered", () => {
  assert.equal(tenantAuditKey("ten_a", "payout.approve", "payout_1"), "ten.ten_a:payout.approve:payout_1");
});

test("tenantStorageKey is tenant-prefixed for isolation at the prefix boundary", () => {
  assert.equal(
    tenantStorageKey("ten_a", "expense-receipts", "receipt_1.png"),
    "ten/ten_a/expense-receipts/receipt_1.png",
  );
});

test("tenantJobEnvelope always carries tenantId", () => {
  const env = tenantJobEnvelope("ten_a", "router.reenableWwwSsl", { routerId: "r_1" }, 1000);
  assert.equal(env.tenantId, "ten_a");
  assert.equal(env.jobType, "router.reenableWwwSsl");
  assert.equal(env.createdAt, 1000);
});

test("webhookTenantId resolves known mappings and quarantines unknown values", () => {
  const mapping = { "sha_123": "ten_a", "sha_456": "ten_b" };
  assert.equal(webhookTenantId("sha_123", mapping), "ten_a");
  assert.equal(webhookTenantId("sha_999", mapping), null);
  assert.equal(webhookTenantId(undefined, mapping), null);
});

test("tenantTransferRunId is deterministic and idempotent", () => {
  assert.equal(tenantTransferRunId("ten_a", "import"), "ten.ten_a.import");
  const a = tenantTransferRunId("ten_b", "export");
  const b = tenantTransferRunId("ten_b", "export");
  assert.equal(a, b);
});

test("isValidTenantIdFormat bounds the id shape", () => {
  assert.equal(isValidTenantIdFormat("ten_a"), true);
  assert.equal(isValidTenantIdFormat(""), false);
  assert.equal(isValidTenantIdFormat("x".repeat(65)), false);
});