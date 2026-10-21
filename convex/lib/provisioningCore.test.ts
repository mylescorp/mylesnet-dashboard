import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROVISIONING_OPEN_STATUSES,
  canRetryProvisioning,
  isOpenProvisioningStatus,
  isProvisioningPending,
  isValidFirmwareLabel,
  nextProvisioningStatus,
  normalizeProvisioningError,
  normalizeProvisioningTransition,
  planProvisioningDecision,
  planProvisioningDeployment,
  planProvisioningRetry,
  recoveryStateAfterDecision,
  recoveryStateAfterDeployment,
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

test("open statuses are pending and approved", () => {
  assert.deepEqual([...PROVISIONING_OPEN_STATUSES], ["pending", "approved"]);
  for (const status of PROVISIONING_OPEN_STATUSES) assert.equal(isOpenProvisioningStatus(status), true);
  assert.equal(isOpenProvisioningStatus("rejected"), false);
  assert.equal(isOpenProvisioningStatus("deployed"), false);
});

test("decision plans are no-ops when the request is already in the target state", () => {
  assert.deepEqual(planProvisioningDecision("approved", "approved", 0), { kind: "noop" });
  assert.deepEqual(planProvisioningDecision("rejected", "rejected", 2), { kind: "noop" });
});

test("decision plans reject illegal transitions", () => {
  assert.equal(planProvisioningDecision("deployed", "approved", 0), null);
  assert.equal(planProvisioningDecision("approved", "rejected", 0), null);
  assert.equal(planProvisioningDecision("rejected", "approved", 1), null);
});

test("first-time decisions reset recovery to idle", () => {
  assert.deepEqual(planProvisioningDecision("pending", "approved", 0), { kind: "apply", status: "approved", recoveryState: "idle" });
  assert.deepEqual(planProvisioningDecision("pending", "rejected", 0), { kind: "apply", status: "rejected", recoveryState: "idle" });
});

test("deciding a retried request keeps recovery visible", () => {
  // Approving a retried request is still in progress...
  assert.deepEqual(planProvisioningDecision("pending", "approved", 1), { kind: "apply", status: "approved", recoveryState: "retrying" });
  // ...and a fresh rejection is a failed recovery, not a silent reset to idle.
  assert.deepEqual(planProvisioningDecision("pending", "rejected", 1), { kind: "apply", status: "rejected", recoveryState: "failed" });
});

test("deployment plans are idempotent and mark retried requests recovered", () => {
  assert.deepEqual(planProvisioningDeployment("deployed", 0), { kind: "noop" });
  assert.deepEqual(planProvisioningDeployment("approved", 0), { kind: "apply", status: "deployed", recoveryState: "idle" });
  assert.deepEqual(planProvisioningDeployment("approved", 3), { kind: "apply", status: "deployed", recoveryState: "recovered" });
  assert.equal(planProvisioningDeployment("pending", 0), null);
  assert.equal(planProvisioningDeployment("rejected", 0), null);
});

test("retry plans return the pending status and retrying recovery only for rejected requests", () => {
  assert.deepEqual(planProvisioningRetry("rejected"), { kind: "apply", status: "pending", recoveryState: "retrying" });
  assert.deepEqual(planProvisioningRetry("pending"), { kind: "not_retryable" });
  assert.deepEqual(planProvisioningRetry("approved"), { kind: "not_retryable" });
  assert.deepEqual(planProvisioningRetry("deployed"), { kind: "not_retryable" });
});

test("recovery-state helpers match the plans", () => {
  assert.equal(recoveryStateAfterDecision(0, "approved"), "idle");
  assert.equal(recoveryStateAfterDecision(0, "rejected"), "idle");
  assert.equal(recoveryStateAfterDecision(1, "approved"), "retrying");
  assert.equal(recoveryStateAfterDecision(1, "rejected"), "failed");
  assert.equal(recoveryStateAfterDeployment(0), "idle");
  assert.equal(recoveryStateAfterDeployment(1), "recovered");
});
