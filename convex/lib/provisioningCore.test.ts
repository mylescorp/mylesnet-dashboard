import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canRetryProvisioning,
  isProvisioningPending,
  isValidFirmwareLabel,
  nextProvisioningStatus,
  normalizeProvisioningError,
  normalizeProvisioningTransition,
  retryProvisioningStatus,
} from "./provisioningCore.ts";

test("provisioning queue lifecycle allows pending → approved → deployed", () => {
  assert.equal(nextProvisioningStatus("pending", "approved"), "approved");
  assert.equal(nextProvisioningStatus("approved", "deployed"), "deployed");
});

test("provisioning queue lifecycle allows pending → rejected", () => {
  assert.equal(nextProvisioningStatus("pending", "rejected"), "rejected");
});

test("provisioning queue rejects illegal transitions with null", () => {
  assert.equal(nextProvisioningStatus("pending", "deployed"), null);
  assert.equal(nextProvisioningStatus("approved", "rejected"), null);
  assert.equal(nextProvisioningStatus("approved", "approved"), null);
  assert.equal(nextProvisioningStatus("rejected", "approved"), null);
  assert.equal(nextProvisioningStatus("rejected", "deployed"), null);
  assert.equal(nextProvisioningStatus("deployed", "deployed"), null);
});

test("normalizing transitions makes decisions idempotent", () => {
  assert.equal(normalizeProvisioningTransition("approved", "approved"), "approved");
  assert.equal(normalizeProvisioningTransition("rejected", "rejected"), "rejected");
  assert.equal(normalizeProvisioningTransition("deployed", "deployed"), "deployed");
  assert.equal(normalizeProvisioningTransition("pending", "approved"), "approved");
  assert.equal(normalizeProvisioningTransition("approved", "rejected"), null);
  assert.equal(normalizeProvisioningTransition("rejected", "deployed"), null);
});

test("retry is only permitted for rejected requests", () => {
  assert.equal(canRetryProvisioning("rejected"), true);
  assert.equal(canRetryProvisioning("pending"), false);
  assert.equal(canRetryProvisioning("approved"), false);
  assert.equal(canRetryProvisioning("deployed"), false);
  assert.equal(retryProvisioningStatus("rejected"), "pending");
  assert.equal(retryProvisioningStatus("approved"), null);
});

test("only pending requests are actionable", () => {
  assert.equal(isProvisioningPending("pending"), true);
  assert.equal(isProvisioningPending("approved"), false);
  assert.equal(isProvisioningPending("rejected"), false);
  assert.equal(isProvisioningPending("deployed"), false);
});

test("firmware label guard accepts absent and valid labels, rejects junk", () => {
  assert.equal(isValidFirmwareLabel(null), true);
  assert.equal(isValidFirmwareLabel(undefined), true);
  assert.equal(isValidFirmwareLabel("v6.49.10"), true);
  assert.equal(isValidFirmwareLabel("  v6.49.10  "), true);
  assert.equal(isValidFirmwareLabel("ab"), false);
  assert.equal(isValidFirmwareLabel(""), false);
  assert.equal(isValidFirmwareLabel("   "), false);
});

test("error normalization caps messages", () => {
  assert.equal(normalizeProvisioningError(null), null);
  assert.equal(normalizeProvisioningError(undefined), null);
  assert.equal(normalizeProvisioningError("boom"), "boom");
  assert.equal(normalizeProvisioningError(new Error("timeout")), "timeout");
  const long = "x".repeat(600);
  const capped = normalizeProvisioningError(long);
  assert(capped !== null && capped.endsWith("...") && capped.length === 500);
});
