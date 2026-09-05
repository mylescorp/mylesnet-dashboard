import {
  extractWorkosEvent,
  hmacSha256Hex,
  hexBytesEqual,
  parseWorkosSignatureHeader,
  verifyWorkosWebhook,
} from "./workosVerify.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

function signBody(rawBody: string, secret: string, timestampSeconds: number): Promise<string> {
  return hmacSha256Hex(secret, `${timestampSeconds}.${rawBody}`);
}

test("parseWorkosSignatureHeader extracts timestamp and v1 signature", () => {
  const { timestamp, signature } = parseWorkosSignatureHeader("t=1701234567,v1=abcdef0123");
  assert.equal(timestamp, 1701234567 * 1000);
  assert.equal(signature, "abcdef0123");
  assert.equal(parseWorkosSignatureHeader(null).timestamp, null);
  assert.equal(parseWorkosSignatureHeader("junk").signature, null);
});

test("verifyWorkosWebhook accepts a valid fresh signature", async () => {
  const rawBody = JSON.stringify({ event: "user.created", data: { id: "user_123" } });
  const secret = "signing-secret";
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = await signBody(rawBody, secret, timestamp);
  const header = `t=${timestamp},v1=${digest}`;
  assert.equal(await verifyWorkosWebhook(rawBody, header, secret), true);
});

test("verifyWorkosWebhook rejects tampered bodies, wrong secrets and stale deliveries", async () => {
  const rawBody = JSON.stringify({ event: "user.created", data: { id: "user_123" } });
  const secret = "signing-secret";
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = await signBody(rawBody, secret, timestamp);
  const header = `t=${timestamp},v1=${digest}`;
  assert.equal(await verifyWorkosWebhook("tampered", header, secret), false);
  assert.equal(await verifyWorkosWebhook(rawBody, header, "wrong-secret"), false);
  assert.equal(await verifyWorkosWebhook(rawBody, null, secret), false);
  const stale = Math.floor((Date.now() - 10 * 60 * 1000) / 1000);
  const staleDigest = await signBody(rawBody, secret, stale);
  assert.equal(
    await verifyWorkosWebhook(rawBody, `t=${stale},v1=${staleDigest}`, secret),
    false,
  );
  assert.equal(
    await verifyWorkosWebhook(rawBody, header, secret, Date.now() + 6 * 60 * 1000),
    false,
  );
});

test("verifyWorkosWebhook is case-insensitive on the delivered hex", async () => {
  const rawBody = '{"event":"user.updated"}';
  const secret = "secret";
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = await signBody(rawBody, secret, timestamp);
  assert.equal(
    await verifyWorkosWebhook(rawBody, `t=${timestamp},v1=${digest.toUpperCase()}`, secret),
    true,
  );
});

test("hexBytesEqual compares hex strings byte-wise", () => {
  assert.equal(hexBytesEqual("abcd", "abcd"), true);
  assert.equal(hexBytesEqual("abcd", "abce"), false);
  assert.equal(hexBytesEqual("abcd", "abc"), false);
});

test("extractWorkosEvent returns the dotted event name", () => {
  assert.equal(extractWorkosEvent('{"event":"organization_membership.created","data":{}}'), "organization_membership.created");
  assert.equal(extractWorkosEvent("{broken"), null);
  assert.equal(extractWorkosEvent('{"foo":"bar"}'), null);
});