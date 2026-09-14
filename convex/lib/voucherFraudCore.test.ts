import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assessRedemptions,
  isFraudFlagStatus,
  type RedemptionRecord,
} from "./voucherFraudCore.ts";

const redeemed = (overrides: Partial<RedemptionRecord> & { code: string }): RedemptionRecord => ({
  voucherId: overrides.voucherId ?? `v-${overrides.code}`,
  code: overrides.code,
  marketId: overrides.marketId ?? "market1",
  redeemedAt: overrides.redeemedAt ?? 1700000000000,
  customerPhone: overrides.customerPhone,
  redeemedDeviceId: overrides.redeemedDeviceId,
  redeemedIpAddress: overrides.redeemedIpAddress,
});

test("a lone redemption is clean with no signals", () => {
  const [row] = assessRedemptions([
    redeemed({ code: "CODE-A", customerPhone: "254700000001", redeemedDeviceId: "dev-1", redeemedIpAddress: "10.0.0.1" }),
  ]);
  assert.deepEqual(row.signals, []);
  assert.equal(row.verdict, "clean");
  assert.equal(row.redeemCount, 1);
  assert.equal(row.distinctIps, 1);
});

test("a duplicate voucher code is blocked outright", () => {
  const rows = assessRedemptions([
    redeemed({ code: "CODE-DUP", customerPhone: "254700000001", redeemedDeviceId: "dev-1", redeemedIpAddress: "10.0.0.1" }),
    redeemed({ code: "CODE-DUP", customerPhone: "254700000001", redeemedDeviceId: "dev-1", redeemedIpAddress: "10.0.0.1" }),
  ]);
  for (const row of rows) {
    assert.ok(row.signals.includes("duplicate_code"));
    assert.equal(row.verdict, "blocked");
    assert.equal(row.redeemCount, 2);
  }
});

test("fast repeated redemptions by the same device exceed the velocity threshold", () => {
  const base = 1700000000000;
  const records: RedemptionRecord[] = ["A", "B", "C", "D", "E"].map((code, i) =>
    redeemed({ code: `CODE-${code}`, redeemedDeviceId: "dev-hog", redeemedIpAddress: "10.0.0.5", redeemedAt: base + i * 60_000 }),
  );
  const rows = assessRedemptions(records);
  for (const row of rows) {
    assert.ok(row.signals.includes("velocity"));
    assert.equal(row.sameDeviceVelocity, 5);
    assert.ok(["flagged", "blocked"].includes(row.verdict));
  }
});

test("velocity is window-bounded: spaced-out redemptions are clean", () => {
  const base = 1700000000000;
  const records: RedemptionRecord[] = ["A", "B", "C"].map((code, i) =>
    redeemed({ code: `CODE-${code}`, redeemedDeviceId: "dev-slow", redeemedIpAddress: "10.0.0.5", redeemedAt: base + i * 60 * 60 * 1000 }),
  );
  const rows = assessRedemptions(records);
  for (const row of rows) {
    assert.ok(!row.signals.includes("velocity"));
    assert.equal(row.verdict, "clean");
  }
});

test("geo-anomaly: one phone seen from multiple distinct IPs", () => {
  const rows = assessRedemptions([
    redeemed({ code: "CODE-G1", customerPhone: "254700000009", redeemedDeviceId: "dev-g", redeemedIpAddress: "10.1.0.1" }),
    redeemed({ code: "CODE-G2", customerPhone: "254700000009", redeemedDeviceId: "dev-g", redeemedIpAddress: "10.2.0.1" }),
  ]);
  for (const row of rows) {
    assert.ok(row.signals.includes("geo_anomaly"));
    assert.equal(row.distinctIps, 2);
  }
});

test("velocity + geo combined yields a blocked verdict", () => {
  const base = 1700000000000;
  const records: RedemptionRecord[] = ["A", "B", "C", "D"].map((code, i) =>
    redeemed({
      code: `CODE-${code}`,
      customerPhone: "254700000009",
      redeemedDeviceId: "dev-ring",
      redeemedIpAddress: i % 2 === 0 ? "10.1.0.1" : "10.2.0.1",
      redeemedAt: base + i * 60_000,
    }),
  );
  const rows = assessRedemptions(records);
  for (const row of rows) {
    assert.ok(row.signals.includes("velocity"));
    assert.ok(row.signals.includes("geo_anomaly"));
    assert.equal(row.verdict, "blocked");
  }
});

test("same market traffic from different customers is not cross-flagged", () => {
  const rows = assessRedemptions([
    redeemed({ code: "CODE-M1", customerPhone: "254700000001", redeemedDeviceId: "dev-a", redeemedIpAddress: "10.0.0.1" }),
    redeemed({ code: "CODE-M2", customerPhone: "254700000002", redeemedDeviceId: "dev-b", redeemedIpAddress: "10.0.0.1" }),
  ]);
  for (const row of rows) assert.equal(row.verdict, "clean");
});

test("signal attribution is per voucher: a clean sibling is never dragged in", () => {
  // dev-a redeems four codes fast (velocity), dev-b redeems one code slowly.
  // dev-b's record must stay clean even though it shares a market with the hog.
  const base = 1700000000000;
  const rows = assessRedemptions([
    ...["A", "B", "C", "D"].map((code, i) =>
      redeemed({ code: `CODE-${code}`, redeemedDeviceId: "dev-a", redeemedIpAddress: "10.0.0.5", redeemedAt: base + i * 60_000 }),
    ),
    redeemed({ code: "CODE-QUIET", redeemedDeviceId: "dev-b", redeemedIpAddress: "10.0.0.6", redeemedAt: base + 600_000 }),
  ]);
  const quiet = rows.find((row) => row.code === "CODE-QUIET");
  assert.ok(quiet);
  assert.ok(!quiet.signals.includes("velocity"));
  assert.equal(quiet.verdict, "clean");
  assert.equal(quiet.sameDeviceVelocity, 1);
});

test("custom velocity window and threshold are honored", () => {
  const base = 1700000000000;
  const records: RedemptionRecord[] = ["A", "B"].map((code, i) =>
    redeemed({ code: `CODE-${code}`, redeemedDeviceId: "dev-t", redeemedIpAddress: "10.0.0.9", redeemedAt: base + i * 60_000 }),
  );
  const loose = assessRedemptions(records, { windowMs: 15 * 60_000, velocityThreshold: 5 });
  for (const row of loose) assert.ok(!row.signals.includes("velocity"));
  const tight = assessRedemptions(records, { windowMs: 15 * 60_000, velocityThreshold: 2 });
  for (const row of tight) assert.ok(row.signals.includes("velocity"));
});

test("isFraudFlagStatus admits the three monitor states only", () => {
  assert.equal(isFraudFlagStatus("clean"), true);
  assert.equal(isFraudFlagStatus("flagged"), true);
  assert.equal(isFraudFlagStatus("blocked"), true);
  assert.equal(isFraudFlagStatus("suspicious"), false);
  assert.equal(isFraudFlagStatus(""), false);
});