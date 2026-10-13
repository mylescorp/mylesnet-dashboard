import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import { paymentCredentialAttestationPayload, verifyPaymentCredentialAttestation } from "./paymentCredentialAttestation.ts";

const key = "test-key-with-at-least-thirty-two-characters";
const operation = { configId: "cfg-1", operationId: "op-1", versionId: "version-1" };
const sign = (input: typeof operation) => createHmac("sha256", key)
  .update(paymentCredentialAttestationPayload(input))
  .digest("base64url");

test("credential attestation accepts a valid signature for the completed secret version", async () => {
  assert.equal(await verifyPaymentCredentialAttestation({ ...operation, attestation: sign(operation) }, key), true);
});

test("credential attestation rejects a signature reused for a different config or version", async () => {
  assert.equal(await verifyPaymentCredentialAttestation({ ...operation, configId: "cfg-2", attestation: sign(operation) }, key), false);
  assert.equal(await verifyPaymentCredentialAttestation({ ...operation, versionId: "invented", attestation: sign(operation) }, key), false);
});

test("credential attestation fails closed when the shared verification key is missing", async () => {
  await assert.rejects(() => verifyPaymentCredentialAttestation({ ...operation, attestation: sign(operation) }, undefined));
});
