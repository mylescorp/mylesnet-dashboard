import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CSRF_HEADER_NAME,
  generateCsrfToken,
  isWellFormedCsrfToken,
  timingSafeEqualString,
  toBase64Url,
  verifyCsrfToken,
} from "./csrf.ts";

test("generateCsrfToken produces distinct, well-formed URL-safe tokens", () => {
  const a = generateCsrfToken();
  const b = generateCsrfToken();
  assert.notEqual(a, b);
  assert.ok(isWellFormedCsrfToken(a));
  assert.ok(isWellFormedCsrfToken(b));
  assert.ok(a.length >= 32);
  assert.doesNotMatch(a, /[+/=]/);
});

test("toBase64Url is deterministic and URL-safe", () => {
  // 255,0,61,251 -> RFC4648 "/wA9+w==" -> URL-safe & unpadded "_wA9-w"
  const bytes = new Uint8Array([0xff, 0x00, 0x3d, 0xfb]);
  assert.equal(toBase64Url(bytes), "_wA9-w");
  const empty = new Uint8Array(0);
  assert.equal(toBase64Url(empty), "");
});

test("isWellFormedCsrfToken rejects malformed values", () => {
  assert.equal(isWellFormedCsrfToken(undefined), false);
  assert.equal(isWellFormedCsrfToken(null), false);
  assert.equal(isWellFormedCsrfToken(""), false);
  assert.equal(isWellFormedCsrfToken("short"), false);
  assert.equal(isWellFormedCsrfToken("a".repeat(200)), false);
  assert.equal(isWellFormedCsrfToken("bad+token!"), false);
});

test("timingSafeEqualString compares constant-time and never throws", () => {
  assert.equal(timingSafeEqualString("abc", "abc"), true);
  assert.equal(timingSafeEqualString("abc", "abd"), false);
  assert.equal(timingSafeEqualString("abc", "abcd"), false);
  assert.equal(timingSafeEqualString(undefined, undefined), false);
  assert.equal(timingSafeEqualString("abc", null as unknown as string), false);
});

test("verifyCsrfToken requires a matching cookie + header pair", () => {
  const token = generateCsrfToken();
  assert.equal(verifyCsrfToken(token, token), true);
  assert.equal(verifyCsrfToken(token, generateCsrfToken()), false);
  assert.equal(verifyCsrfToken(token, undefined), false);
  assert.equal(verifyCsrfToken(undefined, token), false);
  assert.equal(verifyCsrfToken("", ""), false);
  assert.equal(verifyCsrfToken(undefined, undefined), false);
});

test("CSRF_HEADER_NAME matches the convention used by clients", () => {
  assert.equal(CSRF_HEADER_NAME, "X-CSRF-Token");
});