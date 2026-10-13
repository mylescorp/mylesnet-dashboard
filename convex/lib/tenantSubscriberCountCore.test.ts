import { test } from "node:test";
import assert from "node:assert/strict";
import { canWriteSubscriberCount, subscriberCountAfterChange } from "./tenantSubscriberCountCore.ts";

test("subscriber create/delete/restore adjusts known totals without going below zero", () => {
  assert.equal(subscriberCountAfterChange(3, 1), 4);
  assert.equal(subscriberCountAfterChange(3, -1), 2);
  assert.equal(subscriberCountAfterChange(0, -1), 0);
});

test("an unknown total remains unknown until the backfill establishes it", () => {
  assert.equal(subscriberCountAfterChange(undefined, 1), undefined);
  assert.equal(subscriberCountAfterChange(undefined, -1), undefined);
});

test("subscriber writes are paused only while the count backfill runs", () => {
  assert.equal(canWriteSubscriberCount(undefined), true);
  assert.equal(canWriteSubscriberCount(false), true);
  assert.equal(canWriteSubscriberCount(true), false);
});
