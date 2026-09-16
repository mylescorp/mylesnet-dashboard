import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  isFirmwareRolloutStatus,
  resolveRolloutScope,
  firmwareRolloutMatchesDevice,
  devicesForNextWave,
  nextRolloutStatus,
  isRolloutLive,
  buildFirmwareRolloutRow,
  waveProgress,
  type FirmwareRolloutStatus,
} from "./firmwareRolloutCore.ts";

const MARKET_ID = "markets_m1";
const KIND = "mikrotik_gateway";
const DEVICE_IDS = ["dev_a", "dev_b", "dev_c", "dev_d", "dev_e"];

function scopeMarket() {
  return { type: "market" as const, marketId: MARKET_ID };
}
function scopeKind() {
  return { type: "device_kind" as const, deviceKind: KIND };
}
function scopeSingle() {
  return { type: "single" as const, deviceId: "dev_c" };
}

test("resolveRolloutScope: exactly one bound is required", () => {
  assert.deepEqual(
    resolveRolloutScope({ marketId: MARKET_ID, deviceKind: null, deviceId: undefined }),
    { type: "market", marketId: MARKET_ID },
  );
  assert.deepEqual(
    resolveRolloutScope({ marketId: null, deviceKind: KIND, deviceId: undefined }),
    { type: "device_kind", deviceKind: KIND },
  );
  assert.deepEqual(
    resolveRolloutScope({ marketId: undefined, deviceKind: undefined, deviceId: "dev_c" }),
    { type: "single", deviceId: "dev_c" },
  );
});

test("resolveRolloutScope: all-empty and multi-set are invalid (never all-tenants)", () => {
  assert.equal(resolveRolloutScope({ marketId: null, deviceKind: null, deviceId: null }), null);
  assert.equal(
    resolveRolloutScope({ marketId: MARKET_ID, deviceKind: KIND, deviceId: "dev_c" }),
    null,
  );
  assert.equal(
    resolveRolloutScope({ marketId: MARKET_ID, deviceKind: KIND, deviceId: undefined }),
    null,
  );
});

test("firmwareRolloutMatchesDevice: market scope matches by market", () => {
  const scope = scopeMarket();
  assert.equal(
    firmwareRolloutMatchesDevice(scope, { _id: "dev_a", marketId: MARKET_ID, deviceKind: KIND }),
    true,
  );
  assert.equal(
    firmwareRolloutMatchesDevice(scope, { _id: "dev_a", marketId: "markets_other", deviceKind: KIND }),
    false,
  );
});

test("firmwareRolloutMatchesDevice: kind scope matches by device kind", () => {
  const scope = scopeKind();
  assert.equal(
    firmwareRolloutMatchesDevice(scope, { _id: "dev_a", marketId: MARKET_ID, deviceKind: KIND }),
    true,
  );
  assert.equal(
    firmwareRolloutMatchesDevice(scope, { _id: "dev_a", marketId: MARKET_ID, deviceKind: "outdoor_ap" }),
    false,
  );
});

test("firmwareRolloutMatchesDevice: single scope matches by id only", () => {
  const scope = scopeSingle();
  assert.equal(
    firmwareRolloutMatchesDevice(scope, { _id: "dev_c", marketId: MARKET_ID, deviceKind: KIND }),
    true,
  );
  assert.equal(
    firmwareRolloutMatchesDevice(scope, { _id: "dev_a", marketId: MARKET_ID, deviceKind: KIND }),
    false,
  );
});

test("devicesForNextWave: skips applied, caps at wave size, preserves order", () => {
  const candidates = DEVICE_IDS.map((_id, i) => ({
    _id,
    marketId: MARKET_ID,
    deviceKind: KIND,
    sort: i,
  }));
  const ordered = [...candidates].sort((a, b) => a.sort - b.sort);

  assert.deepEqual(
    devicesForNextWave(ordered, [], 2).map((d) => d._id),
    ["dev_a", "dev_b"],
  );
  assert.deepEqual(
    devicesForNextWave(ordered, ["dev_a", "dev_b"], 2).map((d) => d._id),
    ["dev_c", "dev_d"],
  );
  assert.deepEqual(
    devicesForNextWave(ordered, DEVICE_IDS, 3).map((d) => d._id),
    [],
  );
  assert.equal(devicesForNextWave(ordered, ["dev_a"], 2).length, 2);
});

test("devicesForNextWave: all-tenants is impossible (wave is always bounded)", () => {
  const candidates = DEVICE_IDS.map((_id) => ({ _id, marketId: MARKET_ID, deviceKind: KIND }));
  assert.ok(devicesForNextWave(candidates, [], 2).length <= 2);
  assert.ok(devicesForNextWave(candidates, [], 10).length <= 5);
});

test("nextRolloutStatus: canonical lifecycle transitions", () => {
  const cases: Array<[FirmwareRolloutStatus, string, FirmwareRolloutStatus | null]> = [
    ["draft", "start", "running"],
    ["running", "pause", "paused"],
    ["paused", "resume", "running"],
    ["running", "complete", "completed"],
    ["running", "cancel", "cancelled"],
    ["paused", "cancel", "cancelled"],
    ["draft", "cancel", "cancelled"],
    // terminals reject everything
    ["cancelled", "start", null],
    ["cancelled", "resume", null],
    ["completed", "cancel", null],
    ["completed", "complete", null],
    // drafts cannot pause/complete
    ["draft", "pause", null],
    ["draft", "complete", null],
  ];
  for (const [status, transition, expected] of cases) {
    assert.equal(nextRolloutStatus(status, transition as never), expected, `${status}+${transition}`);
  }
});

test("isRolloutLive: running and paused are live, everything else is not", () => {
  assert.equal(isRolloutLive("running"), true);
  assert.equal(isRolloutLive("paused"), true);
  assert.equal(isRolloutLive("draft"), false);
  assert.equal(isRolloutLive("completed"), false);
  assert.equal(isRolloutLive("cancelled"), false);
});

test("isFirmwareRolloutStatus: guards the status set", () => {
  assert.equal(isFirmwareRolloutStatus("running"), true);
  assert.equal(isFirmwareRolloutStatus("paused"), true);
  assert.equal(isFirmwareRolloutStatus("deployed"), false);
});

test("waveProgress: clamps and handles empty target", () => {
  assert.equal(waveProgress(2, 4), 0.5);
  assert.equal(waveProgress(5, 4), 1);
  assert.equal(waveProgress(0, 0), 1);
});

test("buildFirmwareRolloutRow: renders flat row with progress", () => {
  const row = buildFirmwareRolloutRow({
    _id: "roll_1",
    label: "6.49.15",
    marketId: MARKET_ID,
    deviceKind: null,
    deviceId: null,
    waveSize: 2,
    status: "running",
    appliedCount: 2,
    targetCount: 4,
    createdBy: "user_1",
    createdAt: 1000,
    updatedAt: 2000,
    startedAt: 1500,
    completedAt: null,
    cancelledAt: null,
  });
  assert.equal(row.label, "6.49.15");
  assert.deepEqual(row.scope, { type: "market", marketId: MARKET_ID });
  assert.equal(row.status, "running");
  assert.equal(row.appliedCount, 2);
  assert.equal(row.targetCount, 4);
  assert.equal(row.progress, 0.5);
  assert.equal(row.startedAt, 1500);
});

test("buildFirmwareRolloutRow: malformed scope falls back to single-device, never crashes", () => {
  const row = buildFirmwareRolloutRow({
    _id: "roll_2",
    label: "7.14",
    marketId: null,
    deviceKind: null,
    deviceId: null,
    waveSize: 1,
    status: "draft",
    appliedCount: 0,
    targetCount: 0,
    createdBy: null,
    createdAt: 1000,
    updatedAt: 1000,
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
  });
  assert.equal(row.scope.type, "single");
  assert.equal(row.progress, 1);
});