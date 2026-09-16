import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  computeDeviceHealthTone,
  combineHealthTones,
  countTones,
  averageUptimePercent,
  buildHealthRollupRow,
  classifyFirmwareFamily,
  isStalenessWindowValid,
  isSampleFreshnessValid,
  isHealthToneValue,
} from "./healthRollupCore.ts";

const NOW = 1_800_000_000_000;
const OFFLINE_MS = 86400_000; // 24h
const WARNING_MS = 7200_000; // 2h

function device(overrides: Partial<Parameters<typeof computeDeviceHealthTone>[0]> = {}) {
  return {
    lifecycleStatus: "active",
    status: "active",
    uptimePercent: 99.9,
    lastSeenAt: NOW,
    now: NOW,
    offlineAfterMs: OFFLINE_MS,
    warningAfterMs: WARNING_MS,
    ...overrides,
  };
}

test("computeDeviceHealthTone: fresh device is ok", () => {
  assert.equal(computeDeviceHealthTone(device()), "ok");
});

test("computeDeviceHealthTone: device past offline window is critical", () => {
  assert.equal(
    computeDeviceHealthTone(device({ lastSeenAt: NOW - OFFLINE_MS - 1 })),
    "critical",
  );
});

test("computeDeviceHealthTone: device past warning window is warning", () => {
  assert.equal(
    computeDeviceHealthTone(device({ lastSeenAt: NOW - WARNING_MS - 1 })),
    "warning",
  );
});

test("computeDeviceHealthTone: no lastSeenAt is unknown", () => {
  assert.equal(computeDeviceHealthTone(device({ lastSeenAt: null })), "unknown");
});

test("computeDeviceHealthTone: deleted rows are unknown, not incidents", () => {
  assert.equal(
    computeDeviceHealthTone(device({ status: "deleted", lastSeenAt: NOW - OFFLINE_MS - 10 })),
    "unknown",
  );
  assert.equal(
    computeDeviceHealthTone(device({ lifecycleStatus: "deleted", lastSeenAt: NOW - OFFLINE_MS - 10 })),
    "unknown",
  );
});

test("computeDeviceHealthTone: maintenance never reads as an incident", () => {
  assert.equal(
    computeDeviceHealthTone(device({ lifecycleStatus: "maintenance", lastSeenAt: NOW - OFFLINE_MS - 10 })),
    "ok",
  );
});

test("combineHealthTones: critical dominates everything", () => {
  assert.equal(combineHealthTones(["ok", "ok", "critical", "warning", "unknown"]), "critical");
});

test("combineHealthTones: warning beats unknown and ok", () => {
  assert.equal(combineHealthTones(["ok", "unknown", "ok"]), "unknown");
  assert.equal(combineHealthTones(["ok", "warning"]), "warning");
  assert.equal(combineHealthTones(["ok", "ok"]), "ok");
});

test("countTones: counts only present tones", () => {
  assert.deepEqual(countTones(["ok", "critical", "ok", "unknown"]), {
    ok: 2,
    warning: 0,
    critical: 1,
    unknown: 1,
  });
});

test("averageUptimePercent: ignores unknown values, rounds to 2dp", () => {
  assert.equal(averageUptimePercent([99.955, 100, 50.4]), 83.45);
  assert.equal(averageUptimePercent([]), null);
  assert.equal(averageUptimePercent([null, undefined]), null);
});

test("classifyFirmwareFamily: trims + lowercases, unknown for empty", () => {
  assert.equal(classifyFirmwareFamily(" RouterOS 6.49 "), "routeros 6.49");
  assert.equal(classifyFirmwareFamily(""), "unknown");
  assert.equal(classifyFirmwareFamily(null), "unknown");
});

test("isStalenessWindowValid + isSampleFreshnessValid: finite positive or null", () => {
  assert.equal(isStalenessWindowValid(86400_000), true);
  assert.equal(isStalenessWindowValid(-1), false);
  assert.equal(isStalenessWindowValid(Number.NaN), false);
  assert.equal(isStalenessWindowValid(null), true);
  assert.equal(isSampleFreshnessValid(600_000), true);
  assert.equal(isSampleFreshnessValid(0), false);
  assert.equal(isSampleFreshnessValid(undefined), true);
});

test("isHealthToneValue: guards the tone set", () => {
  assert.equal(isHealthToneValue("ok"), true);
  assert.equal(isHealthToneValue("critical"), true);
  assert.equal(isHealthToneValue("offline"), false);
});

test("buildHealthRollupRow: aggregates counts, tones, uptime, firmware, alerts", () => {
  const row = buildHealthRollupRow({
    now: NOW,
    offlineAfterMs: OFFLINE_MS,
    warningAfterMs: WARNING_MS,
    deviceTones: ["ok", "ok", "warning", "critical"],
    uptimeValues: [99.9, 98.1, 100, null],
    firmwareValues: ["RouterOS 6.49", "routeros 6.49", " 7.14 "],
    routerTotal: 3,
    routerRecentSamples: 2,
    openAlerts: [
      { severity: "critical" },
      { severity: "critical" },
      { severity: "warning" },
      { severity: "info" },
    ],
  });

  assert.equal(row.generatedAt, NOW);
  assert.deepEqual(row.devices.byTone, { ok: 2, warning: 1, critical: 1, unknown: 0 });
  assert.equal(row.devices.total, 4);
  assert.ok(row.devices.averageUptimePercent !== null);
  assert.deepEqual(row.devices.firmwareFamilies, ["7.14", "routeros 6.49"]);
  assert.equal(row.routers.total, 3);
  assert.equal(row.routers.withRecentSample, 2);
  assert.equal(row.openAlerts.total, 4);
  assert.equal(row.openAlerts.critical, 2);
  assert.equal(row.openAlerts.warning, 1);
  assert.equal(row.openAlerts.info, 1);
  assert.equal(row.bestDeviceTone, "critical");
  assert.equal(row.overallTone, "critical");
});

test("buildHealthRollupRow: no devices, no alerts -> ok, null uptime", () => {
  const row = buildHealthRollupRow({
    now: NOW,
    offlineAfterMs: OFFLINE_MS,
    warningAfterMs: WARNING_MS,
    deviceTones: [],
    uptimeValues: [],
    firmwareValues: [],
    routerTotal: 0,
    routerRecentSamples: 0,
    openAlerts: [],
  });
  assert.equal(row.devices.total, 0);
  assert.equal(row.overallTone, "ok");
  assert.equal(row.devices.averageUptimePercent, null);
  assert.equal(row.openAlerts.total, 0);
});