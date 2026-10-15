import assert from "node:assert/strict";
import { test } from "node:test";
import { isPaymentGatewayRotationActive, makePublicGatewaySettingsUpdate } from "./paymentGatewayUpdateCore.ts";

test("a finance update omits environment and short code when they are left unchanged", () => {
  assert.deepEqual(makePublicGatewaySettingsUpdate({ tenantId: "tenant-1", environment: "", shortCode: "  " }), {
    tenantId: "tenant-1",
  });
});

test("a finance update includes only the non-secret fields explicitly changed", () => {
  assert.deepEqual(makePublicGatewaySettingsUpdate({ tenantId: "tenant-1", environment: "production", shortCode: " 12345 " }), {
    tenantId: "tenant-1",
    environment: "production",
    shortCode: "12345",
  });
});

test("a credential rotation lease stops blocking work after its expiry", () => {
  assert.equal(isPaymentGatewayRotationActive({ pending: true, leaseExpiresAt: 10_000, now: 9_999 }), true);
  assert.equal(isPaymentGatewayRotationActive({ pending: true, leaseExpiresAt: 10_000, now: 10_000 }), false);
  assert.equal(isPaymentGatewayRotationActive({ pending: false, leaseExpiresAt: 10_000, now: 0 }), false);
});
