import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isProvisioningPending,
  isValidFirmwareLabel,
  nextProvisioningStatus,
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