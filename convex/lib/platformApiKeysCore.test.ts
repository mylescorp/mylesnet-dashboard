import { test } from "node:test";
import assert from "node:assert/strict";
import { isPlatformApiKeyActive, validatePlatformKeyInput } from "./platformApiKeysCore.ts";

const now = 1_800_000_000_000;
test("platform API key scope inputs deduplicate and trim names", () => {
  assert.deepEqual(validatePlatformKeyInput("  integration  ", ["organizations:read", "organizations:read"], undefined, now), { name: "integration", scopes: ["organizations:read"] });
});

test("platform API credentials are inactive when revoked or expired", () => {
  assert.equal(isPlatformApiKeyActive({}, now), true);
  assert.equal(isPlatformApiKeyActive({ expiresAt: now + 1 }, now), true);
  assert.equal(isPlatformApiKeyActive({ expiresAt: now }, now), false);
  assert.equal(isPlatformApiKeyActive({ revokedAt: now }, now), false);
});
test("platform API key input rejects empty names, scopes, unknown scopes, and excessive expiry", () => {
  for (const input of [["", ["organizations:read"], undefined], ["x", [], undefined], ["x", ["admin:*"], undefined], ["x", ["billing:read"], now + 366 * 24 * 60 * 60 * 1000]] as const) {
    assert.throws(() => validatePlatformKeyInput(input[0], [...input[1]], input[2], now));
  }
});
