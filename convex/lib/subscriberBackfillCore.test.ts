import { test } from "node:test";
import assert from "node:assert/strict";
import { subscriberBackfillStartState } from "./subscriberBackfillCore.ts";

test("fresh subscriber scans reset stale saved progress", () => {
  assert.deepEqual(subscriberBackfillStartState(false, "old-cursor", 42), { cursor: null, progress: 0 });
});

test("stale subscriber scans resume only their committed checkpoint", () => {
  assert.deepEqual(subscriberBackfillStartState(true, "saved-cursor", 42), { cursor: "saved-cursor", progress: 42 });
  assert.deepEqual(subscriberBackfillStartState(true, undefined, undefined), { cursor: null, progress: 0 });
});
