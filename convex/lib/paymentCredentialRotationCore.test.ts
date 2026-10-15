import assert from "node:assert/strict";
import { test } from "node:test";
import { credentialRotationRequestState } from "./paymentCredentialRotationCore.ts";

const duration = 5 * 60 * 1000;

test("a live rotation lease blocks a different request and resumes its idempotent request", () => {
  const lease = { operationId: "operation-a", startedAt: 10_000 };
  assert.equal(credentialRotationRequestState({ lease, requestedOperationId: "operation-b", now: 20_000, leaseDurationMs: duration }), "blocked");
  assert.equal(credentialRotationRequestState({ lease, requestedOperationId: "operation-a", now: 20_000, leaseDurationMs: duration }), "resume");
});

test("an expired or malformed lease can be replaced after a partial secret-store write", () => {
  assert.equal(credentialRotationRequestState({ lease: { operationId: "operation-a", startedAt: 10_000 }, requestedOperationId: "operation-b", now: 10_000 + duration, leaseDurationMs: duration }), "start");
  assert.equal(credentialRotationRequestState({ lease: { operationId: "operation-a" }, requestedOperationId: "operation-b", now: 20_000, leaseDurationMs: duration }), "start");
});
