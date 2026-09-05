import {
  decryptCentipidSecret,
  encryptCentipidSecret,
  isEncryptedCentipidSecret,
} from "./centipidCredentials.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

function generateBase64Key(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Buffer.from(bytes).toString("base64");
}

test("encrypt/decrypt round-trips a credential with the encryption key configured", async () => {
  process.env.CENTIPID_CREDENTIALS_ENCRYPTION_KEY = generateBase64Key();
  const plainText = "12|a1b2c3d4e5f67890";
  const encrypted = await encryptCentipidSecret(plainText);
  assert.equal(isEncryptedCentipidSecret(encrypted), true);
  assert.notEqual(encrypted, plainText);
  assert.equal(await decryptCentipidSecret(encrypted), plainText);
});

test("encrypting twice yields different ciphertexts (fresh IV per call)", async () => {
  process.env.CENTIPID_CREDENTIALS_ENCRYPTION_KEY = generateBase64Key();
  const first = await encryptCentipidSecret("same-secret");
  const second = await encryptCentipidSecret("same-secret");
  assert.notEqual(first, second);
  assert.equal(await decryptCentipidSecret(first), "same-secret");
  assert.equal(await decryptCentipidSecret(second), "same-secret");
});

test("legacy plaintext credentials pass through without an encryption key", async () => {
  delete process.env.CENTIPID_CREDENTIALS_ENCRYPTION_KEY;
  assert.equal(isEncryptedCentipidSecret("plain-value"), false);
  assert.equal(await decryptCentipidSecret("plain-value"), "plain-value");
});

test("encryption fails cleanly when no key is configured", async () => {
  delete process.env.CENTIPID_CREDENTIALS_ENCRYPTION_KEY;
  await assert.rejects(() => encryptCentipidSecret("anything"), /not configured/);
});

test("encryption rejects a key that is not a 32-byte base64 value", async () => {
  process.env.CENTIPID_CREDENTIALS_ENCRYPTION_KEY = Buffer.from("too-short").toString("base64");
  await assert.rejects(() => encryptCentipidSecret("anything"), /not configured/);
});