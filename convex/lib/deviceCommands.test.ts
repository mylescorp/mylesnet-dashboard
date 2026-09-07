import { test } from "node:test";
import assert from "node:assert/strict";
import {
  countReenablesInWindow,
  isChronic,
  nextCommandStatus,
  pruneReenableWindow,
} from "./deviceCommandCore.ts";

test("nextCommandStatus follows the pending -> acknowledged -> completed lifecycle", () => {
  assert.equal(nextCommandStatus("pending", "acknowledged"), "acknowledged");
  assert.equal(nextCommandStatus("acknowledged", "completed"), "completed");
  assert.equal(nextCommandStatus("acknowledged", "failed"), "failed");
  assert.equal(nextCommandStatus("pending", "failed"), "failed");
});

test("nextCommandStatus is a no-op for invalid or repeated transitions", () => {
  assert.equal(nextCommandStatus("pending", "completed"), null);
  assert.equal(nextCommandStatus("acknowledged", "acknowledged"), null);
  assert.equal(nextCommandStatus("completed", "completed"), null);
  assert.equal(nextCommandStatus("completed", "failed"), null);
  assert.equal(nextCommandStatus("failed", "acknowledged"), null);
  assert.equal(nextCommandStatus("superseded", "completed"), null);
});

test("pruneReenableWindow drops timestamps older than the window", () => {
  const now = 10_000_000;
  const windowMs = 24 * 60 * 60 * 1000;
  assert.deepEqual(pruneReenableWindow([now - 1000, now - windowMs, now - windowMs - 1], now, windowMs), [now - 1000]);
  assert.deepEqual(pruneReenableWindow([], now, windowMs), []);
});

test("countReenablesInWindow adds, dedupes and caps re-enables", () => {
  const now = 20_000_000;
  const windowMs = 24 * 60 * 60 * 1000;
  const fresh = now;
  const older = now - windowMs + 1;
  let window = countReenablesInWindow([], fresh, now, windowMs, 30);
  assert.equal(window.count, 1);
  assert.deepEqual(window.reenableTimestamps, [fresh]);

  window = countReenablesInWindow(window.reenableTimestamps, fresh, now, windowMs, 30);
  assert.equal(window.count, 1, "the same action timestamp must not double-count");

  window = countReenablesInWindow(window.reenableTimestamps, older, now, windowMs, 30);
  assert.equal(window.count, 2);

  window = countReenablesInWindow(window.reenableTimestamps, now - windowMs, now, windowMs, 30);
  assert.equal(window.count, 2, "an action exactly on the window edge is dropped");

  const capped = countReenablesInWindow(
    [now - 3000, now - 2000, now - 1000],
    now,
    now,
    windowMs,
    3,
  );
  assert.deepEqual(capped.reenableTimestamps, [now - 2000, now - 1000, now]);
  assert.equal(capped.count, 3);
});

test("isChronic flags counts at or above the threshold and rejects bad thresholds", () => {
  const threshold = 3;
  assert.equal(isChronic(2, threshold), false);
  assert.equal(isChronic(3, threshold), true);
  assert.equal(isChronic(4, threshold), true);
  assert.equal(isChronic(5, 0), false);
  assert.equal(isChronic(5, Number.NaN), false);
});