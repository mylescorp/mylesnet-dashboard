import { test } from "node:test";
import assert from "node:assert/strict";
import {
  cursorToIndex,
  failingCountAssertions,
  failingInvariants,
  isActiveRun,
  mergeBatchIntoManifest,
  nextRunStatus,
  recordCheckpoint,
  shouldProceed,
  takeBoundedBatch,
} from "./migrationRunCore.ts";

test("nextRunStatus advances the run lifecycle and is idempotent once terminal", () => {
  assert.equal(nextRunStatus("planned", "start"), "running");
  assert.equal(nextRunStatus("running", "complete"), "completed");
  assert.equal(nextRunStatus("running", "rollback"), "rolled_back");
  assert.equal(nextRunStatus("running", "fail"), "failed");
  assert.equal(nextRunStatus("planned", "cancel"), "cancelled");
  assert.equal(nextRunStatus("running", "cancel"), "cancelled");
});

test("nextRunStatus never re-runs a terminal run", () => {
  assert.equal(nextRunStatus("completed", "start"), "completed");
  assert.equal(nextRunStatus("rolled_back", "start"), "rolled_back");
  assert.equal(nextRunStatus("failed", "start"), "failed");
  assert.equal(nextRunStatus("cancelled", "start"), "cancelled");
  assert.equal(nextRunStatus("completed", "complete"), "completed");
});

test("isActiveRun is true only while the run is non-terminal", () => {
  assert.equal(isActiveRun("planned"), true);
  assert.equal(isActiveRun("running"), true);
  assert.equal(isActiveRun("completed"), false);
  assert.equal(isActiveRun("rolled_back"), false);
  assert.equal(isActiveRun("failed"), false);
  assert.equal(isActiveRun("cancelled"), false);
});

test("takeBoundedBatch chunks ordered keys into bounded batches with a cursor", () => {
  const keys = ["a", "b", "c", "d", "e"];
  const first = takeBoundedBatch(keys, 0, 2);
  assert.deepEqual(first.batch, ["a", "b"]);
  assert.equal(first.hasMore, true);
  assert.equal(first.cursor, "2");

  const second = takeBoundedBatch(keys, cursorToIndex(first.cursor), 2);
  assert.deepEqual(second.batch, ["c", "d"]);
  assert.equal(second.hasMore, true);
  assert.equal(second.cursor, "4");

  const third = takeBoundedBatch(keys, cursorToIndex(second.cursor), 2);
  assert.deepEqual(third.batch, ["e"]);
  assert.equal(third.hasMore, false);
  assert.equal(third.cursor, null);
});

test("takeBoundedBatch returns an empty result for a bad batch size", () => {
  assert.deepEqual(takeBoundedBatch(["a"], 0, 0), { cursor: null, batch: [], hasMore: false });
  assert.deepEqual(takeBoundedBatch(["a"], 0, -1), { cursor: null, batch: [], hasMore: false });
  assert.deepEqual(takeBoundedBatch(["a"], 0, Number.NaN), { cursor: null, batch: [], hasMore: false });
});

test("cursorToIndex tolerates null / garbage cursors", () => {
  assert.equal(cursorToIndex(null), 0);
  assert.equal(cursorToIndex(undefined), 0);
  assert.equal(cursorToIndex("4"), 4);
  assert.equal(cursorToIndex("abc"), 0);
});

test("mergeBatchIntoManifest accumulates per-table counts idempotently", () => {
  let manifest = {};
  manifest = mergeBatchIntoManifest(manifest, { tenants: 2 });
  manifest = mergeBatchIntoManifest(manifest, { tenants: 3, markets: 1 });
  manifest = mergeBatchIntoManifest(manifest, { markets: 1 });
  assert.deepEqual(manifest, { tenants: 5, markets: 2 });
});

test("failingCountAssertions reports only mismatches", () => {
  const assertions = [
    { name: "tenants rows", expected: 10, actual: 10 },
    { name: "markets rows", expected: 8, actual: 7 },
  ];
  assert.deepEqual(failingCountAssertions(assertions), ["markets rows"]);
  assert.deepEqual(failingCountAssertions([]), []);
});

test("failingInvariants reports only failing invariants with detail", () => {
  const invariants = [
    { name: "fk ok", ok: true },
    { name: "no orphans", ok: false, detail: "5 orphan rows" },
    { name: "unique", ok: true },
  ];
  assert.deepEqual(failingInvariants(invariants), [
    { name: "no orphans", ok: false, detail: "5 orphan rows" },
  ]);
  assert.deepEqual(failingInvariants([]), []);
});

test("recordCheckpoint captures a point-in-time rollback marker", () => {
  const checkpoint = recordCheckpoint("tenantId backfill", "42", 1_024, 123_456_789);
  assert.deepEqual(checkpoint, {
    phase: "tenantId backfill",
    cursor: "42",
    rowsProcessed: 1_024,
    recordedAt: 123_456_789,
  });
});

test("shouldProceed gates enforcement behind a required feature flag", () => {
  assert.equal(shouldProceed(true, true), true);
  assert.equal(shouldProceed(false, true), false);
  assert.equal(shouldProceed(false, false), true, "non-required flags do not gate");
  assert.equal(shouldProceed(true, false), true);
});
