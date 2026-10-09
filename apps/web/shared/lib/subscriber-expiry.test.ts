import { test } from "node:test";
import assert from "node:assert/strict";
import { toEditedExpiryTimestamp } from "./subscriber-expiry.ts";

test("changing expiry date preserves the existing time of day", () => {
  const previous = Date.parse("2026-10-08T14:37:12.345Z");
  assert.equal(toEditedExpiryTimestamp("2026-10-12", previous), Date.parse("2026-10-12T14:37:12.345Z"));
});

test("clearing expiry explicitly clears it", () => {
  assert.equal(toEditedExpiryTimestamp("", 1_800_000_000_000), null);
});

test("a new expiry date defaults to midnight UTC", () => {
  assert.equal(toEditedExpiryTimestamp("2026-10-12", undefined), Date.parse("2026-10-12T00:00:00.000Z"));
});
