import {
  bytesConstantTimeEqual,
  classifyEvent,
  collectEntityRecords,
  extractEventType,
  extractSignatureValue,
  extractWebhookEventId,
  hmacSha256Hex,
  inferCentipidEvent,
  mcpTextContents,
  parseAmountDisplay,
  parseCentipidTimestamp,
  parseMcpResponse,
  pickString,
  verifyWebhookSignature,
} from "./centipidVerify.ts";
import assert from "node:assert/strict";
import { test } from "node:test";

test("bytesConstantTimeEqual matches identical bytes and rejects any difference", () => {
  assert.equal(bytesConstantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 3])), true);
  assert.equal(bytesConstantTimeEqual(new Uint8Array([1, 2, 3]), new Uint8Array([1, 2, 4])), false);
  assert.equal(bytesConstantTimeEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2, 3])), false);
});

test("hmacSha256Hex produces a 64-char lowercase hex digest", async () => {
  const digest = await hmacSha256Hex("secret", "message");
  assert.equal(/^[0-9a-f]{64}$/.test(digest), true);
  assert.equal(await hmacSha256Hex("secret", "other-message") !== digest, true);
});

test("verifyWebhookSignature accepts hex and base64 digests over the raw body", async () => {
  const rawBody = '{"event_type":"payment.received","amount":5000}';
  const digestHex = await hmacSha256Hex("signing-secret", rawBody);
  assert.equal(await verifyWebhookSignature(rawBody, `sha256=${digestHex}`, "signing-secret"), true);
  assert.equal(await verifyWebhookSignature(rawBody, `v1=${digestHex}`, "signing-secret"), true);
  assert.equal(
    await verifyWebhookSignature(rawBody, `t=1234567890,v0=unused,v1=${digestHex}`, "signing-secret"),
    true,
  );
  const digestB64 = Buffer.from(digestHex, "hex").toString("base64");
  assert.equal(await verifyWebhookSignature(rawBody, digestB64, "signing-secret"), true);
});

test("verifyWebhookSignature rejects tampered bodies, wrong secrets, and missing headers", async () => {
  const rawBody = '{"event_type":"payment.received","amount":5000}';
  const digestHex = await hmacSha256Hex("signing-secret", rawBody);
  assert.equal(await verifyWebhookSignature("tampered", `sha256=${digestHex}`, "signing-secret"), false);
  assert.equal(await verifyWebhookSignature(rawBody, `sha256=${digestHex}`, "wrong-secret"), false);
  assert.equal(await verifyWebhookSignature(rawBody, null, "signing-secret"), false);
  assert.equal(await verifyWebhookSignature(rawBody, "not-a-valid-hex-value!", "signing-secret"), false);
});

test("extractSignatureValue handles comma, prefixed and bare header shapes", () => {
  assert.equal(extractSignatureValue("t=1700000000,v1=abcdef,v0=ghijkl"), "abcdef");
  assert.equal(extractSignatureValue("sha256=xyz"), "xyz");
  assert.equal(extractSignatureValue("v1=xyz"), "xyz");
  assert.equal(extractSignatureValue("rawhexvalue"), "rawhexvalue");
  assert.equal(extractSignatureValue(""), null);
  assert.equal(extractSignatureValue(null), null);
  assert.equal(extractSignatureValue("   "), null);
});

test("pickString returns the first present key and ignores empty values", () => {
  assert.equal(pickString({ phone: "2567", mobile: "000" }, ["phone", "mobile"]), "2567");
  assert.equal(pickString({ phone: "", mobile: "000" }, ["phone", "mobile"]), "000");
  assert.equal(pickString(null, ["phone"]), "");
  assert.equal(pickString("nope", ["phone"]), "");
  assert.equal(pickString({ nested: { phone: "2567" } }, ["nope"]), "");
});

test("extractEventType reads top-level and nested data event types and rejects unknowns", () => {
  assert.equal(extractEventType({ event_type: "subscriber.created" }), "subscriber.created");
  assert.equal(extractEventType({ eventType: "payment.refunded" }), "payment.refunded");
  assert.equal(extractEventType({ type: "voucher.redeemed" }), "voucher.redeemed");
  assert.equal(extractEventType({ data: { event: "ticket.resolved" } }), "ticket.resolved");
  assert.equal(extractEventType({ event: "unknown.happened" }), null);
  assert.equal(extractEventType(null), null);
  assert.equal(extractEventType({ data: "text" }), null);
});

test("classifyEvent maps the event type to its category", () => {
  assert.deepEqual(classifyEvent({ event_type: "subscriber.paused" }), { category: "subscriber", eventType: "subscriber.paused" });
  assert.deepEqual(classifyEvent({ event: "payment.received" }), { category: "payment", eventType: "payment.received" });
  assert.deepEqual(classifyEvent({ event: "unknown.event" }), { category: null, eventType: null });
});

test("extractWebhookEventId prefers top-level then data-nested ids", () => {
  assert.equal(extractWebhookEventId({ webhook_event_id: "wh_1", data: { id: "data_1" } }), "wh_1");
  assert.equal(extractWebhookEventId({ data: { eventId: "data_1" } }), "data_1");
  assert.equal(extractWebhookEventId({ name: "subscriber.created" }), null);
});

test("parseMcpResponse handles plain JSON and SSE data: frames", () => {
  assert.deepEqual(parseMcpResponse('{"result":{"ok":true}}'), { result: { ok: true } });
  assert.deepEqual(parseMcpResponse('data: {"result":{"ok":true}}\n\ndata: [DONE]\n'), {
    result: { ok: true },
  });
  assert.throws(() => parseMcpResponse("not json"), SyntaxError);
});

test("mcpTextContents extracts text from tools/call content items", () => {
  const parsed = {
    result: {
      content: [
        { type: "text", text: "row one" },
        { type: "image", data: "skipped" },
        { type: "text", text: "row two" },
      ],
    },
  };
  assert.deepEqual(mcpTextContents(parsed), ["row one", "row two"]);
  assert.deepEqual(mcpTextContents(null), []);
});

test("parseAmountDisplay parses numeric, formatted, and currency-prefixed strings", () => {
  assert.deepEqual(parseAmountDisplay(5000), { amount: 5000, currency: "UGX" });
  assert.deepEqual(parseAmountDisplay("UGX 1,000.00"), { amount: 1000, currency: "UGX" });
  assert.deepEqual(parseAmountDisplay("KES 2,500"), { amount: 2500, currency: "KES" });
  assert.deepEqual(parseAmountDisplay("3,200"), { amount: 3200, currency: "UGX" });
  assert.deepEqual(parseAmountDisplay(""), { amount: 0, currency: "UGX" });
});

test("parseCentipidTimestamp resolves ISO, epoch and space-separated timestamps", () => {
  const iso = Date.parse("2026-09-04T19:19:56.000Z");
  assert.equal(parseCentipidTimestamp("2026-09-04T19:19:56.000Z"), iso);
  assert.equal(parseCentipidTimestamp(iso), iso);
  const spaceSplit = new Date(2026, 8, 6, 8, 17, 10).getTime();
  assert.equal(parseCentipidTimestamp("2026-09-06 08:17:10"), spaceSplit);
  const batchSplit = new Date(2026, 8, 4, 19, 44, 0).getTime();
  assert.equal(parseCentipidTimestamp("Vouchers 2026-09-04 19:44"), batchSplit);
  assert.equal(parseCentipidTimestamp(""), undefined);
  assert.equal(parseCentipidTimestamp("not-a-date"), undefined);
});

test("collectEntityRecords walks data, payload, event and object containers", () => {
  const payload = {
    event: "voucher.redeemed",
    timestamp: "2026-09-06 08:17:10",
    data: { code: "RT2XKZ" },
    payload: { package_name: "Half Day" },
  };
  const records = collectEntityRecords(payload);
  assert.equal(records[0], payload);
  assert.deepEqual(records[1], { code: "RT2XKZ" });
  assert.deepEqual(records[2], { package_name: "Half Day" });
  assert.equal(records.length, 3);
  assert.deepEqual(collectEntityRecords(null), []);
  assert.deepEqual(collectEntityRecords("text"), []);
});

test("extractEventType reads event types from nested envelopes", () => {
  assert.equal(extractEventType({ payload: { event_type: "subscriber.created" } }), "subscriber.created");
  assert.equal(extractEventType({ event: { event: "payment.refunded" } }), "payment.refunded");
  assert.equal(extractEventType({ object: { type: "ticket.opened" } }), "ticket.opened");
  assert.equal(extractEventType({ data: { name: "voucher.redeemed" } }), "voucher.redeemed");
});

test("extractWebhookEventId reads ids from nested envelopes", () => {
  assert.equal(extractWebhookEventId({ payload: { event_id: "wh_9" } }), "wh_9");
  assert.equal(extractWebhookEventId({ event: { id: "wh_8" } }), "wh_8");
  assert.equal(extractWebhookEventId({ object: { uuid: "wh_7" } }), "wh_7");
});

test("inferCentipidEvent classifies recognisable entities without an event type", () => {
  assert.deepEqual(
    inferCentipidEvent({ data: { amount: "UGX 1,000.00", method: "MTN", phone: "256700" } }),
    { category: "payment", eventType: "payment.unknown" },
  );
  assert.deepEqual(
    inferCentipidEvent({ payload: { code: "RT2XKZ", package: "Half Day", redeemed_at: "2026-09-06 08:17:10" } }),
    { category: "voucher", eventType: "voucher.unknown" },
  );
  assert.deepEqual(
    inferCentipidEvent({ data: { subject: "No internet", priority: "high", ticket_id: "T-42" } }),
    { category: "ticket", eventType: "ticket.unknown" },
  );
  assert.deepEqual(
    inferCentipidEvent({ username: "pppoe-9", phone: "256700000000", plan: "Monthly 30GB" }),
    { category: "subscriber", eventType: "subscriber.unknown" },
  );
  assert.equal(inferCentipidEvent({ name: "Yesterday" }), null);
  assert.equal(inferCentipidEvent(null), null);
});