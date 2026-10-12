import test from "node:test";
import assert from "node:assert/strict";
import {
  findSamePayment,
  isSamePayment,
  normalizePaymentIdempotencyKey,
  type PaymentIdempotencyKey,
} from "./paymentIdempotencyCore.ts";

test("normalizePaymentIdempotencyKey trims surrounding whitespace", () => {
  assert.deepEqual(
    normalizePaymentIdempotencyKey({ gateway: "  mobile_money ", reference: " PAY-1 " }),
    { gateway: "mobile_money", reference: "PAY-1" },
  );
});

test("isSamePayment matches the same tenant, gateway and reference", () => {
  const existing = { tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-1" };
  assert.equal(
    isSamePayment(existing, { tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-1" }),
    true,
  );
});

test("isSamePayment never dedupes across tenants", () => {
  const existing = { tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-1" };
  assert.equal(
    isSamePayment(existing, { tenantId: "tenant-2", gateway: "mobile_money", reference: "PAY-1" }),
    false,
  );
});

test("isSamePayment matches a row written before normalization", () => {
  const legacy = { tenantId: "tenant-1", gateway: " mobile_money ", reference: " PAY-1 " };
  assert.equal(
    isSamePayment(legacy, { tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-1" }),
    true,
  );
});

test("isSamePayment rejects a different reference", () => {
  const existing = { tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-1" };
  assert.equal(
    isSamePayment(existing, { tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-2" }),
    false,
  );
});

test("findSamePayment returns the duplicate a retry should resolve to", () => {
  const rows = [
    { _id: "p1", tenantId: "tenant-2", gateway: "mobile_money", reference: "PAY-1" },
    { _id: "p2", tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-1" },
  ];
  const match = findSamePayment(rows, {
    tenantId: "tenant-1",
    gateway: "mobile_money",
    reference: "PAY-1",
  });
  assert.equal(match?._id, "p2");
});

test("findSamePayment returns null when no candidate matches", () => {
  const rows = [
    { _id: "p1", tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-1" },
  ];
  assert.equal(
    findSamePayment(rows, { tenantId: "tenant-1", gateway: "mobile_money", reference: "PAY-9" }),
    null,
  );
});

test("a retried submission resolves to the first payment and tenants stay separate", () => {
  // Mirrors the create path: the store is keyed by the normalized pair inside a
  // tenant, and a second submission with the same key resolves to the first row.
  const store: Array<{
    _id: string;
    tenantId: string;
    gateway: string;
    reference: string;
  }> = [];
  let nextId = 1;
  const create = (tenantId: string, key: PaymentIdempotencyKey) => {
    const existing = findSamePayment(store, { tenantId, ...key });
    if (existing) return existing._id;
    const normalized = normalizePaymentIdempotencyKey(key);
    const id = `p${nextId++}`;
    store.push({ _id: id, tenantId, ...normalized });
    return id;
  };

  const first = create("tenant-1", { gateway: "mobile_money", reference: "PAY-1" });
  const retry = create("tenant-1", { gateway: " mobile_money ", reference: " PAY-1 " });
  assert.equal(retry, first);
  assert.equal(store.length, 1);

  const otherTenant = create("tenant-2", { gateway: "mobile_money", reference: "PAY-1" });
  assert.notEqual(otherTenant, first);
  assert.equal(store.length, 2);
});
