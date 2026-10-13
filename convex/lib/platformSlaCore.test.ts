import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSlaPriority, effectiveSlaTargets, PLATFORM_SLA_FALLBACK, ticketDeadlines, validateSlaTargets } from "./platformSlaCore.ts";

test("network ticket fallback has the shortest response and resolution targets", () => {
  assert.ok(PLATFORM_SLA_FALLBACK.network.firstResponseMinutes < PLATFORM_SLA_FALLBACK.billing.firstResponseMinutes);
  assert.ok(PLATFORM_SLA_FALLBACK.network.resolutionMinutes < PLATFORM_SLA_FALLBACK.account.resolutionMinutes);
});

test("ticket deadlines are derived from policy minutes", () => {
  assert.deepEqual(ticketDeadlines(1_000, { firstResponseMinutes: 15, resolutionMinutes: 240 }), {
    firstResponseDueAt: 901_000,
    resolutionDueAt: 14_401_000,
  });
});

test("effective SLA targets expose defaults for categories without overrides", () => {
  const fallback = PLATFORM_SLA_FALLBACK;
  assert.deepEqual(effectiveSlaTargets({ billing: { firstResponseMinutes: 45, resolutionMinutes: 1200 } }), {
    network: fallback.network,
    billing: { firstResponseMinutes: 45, resolutionMinutes: 1200 },
    account: fallback.account,
  });
});

test("SLA targets enforce integer bounds and require resolution after response", () => {
  for (const value of [0, 1.5, 525_601, Number.NaN]) {
    assert.throws(() => validateSlaTargets({ firstResponseMinutes: value, resolutionMinutes: 30 }));
  }
  assert.throws(() => validateSlaTargets({ firstResponseMinutes: 60, resolutionMinutes: 59 }));
  assert.doesNotThrow(() => validateSlaTargets({ firstResponseMinutes: 60, resolutionMinutes: 60 }));
});

test("network response and resolution remain faster than billing and account", () => {
  const targets = effectiveSlaTargets({});
  assert.doesNotThrow(() => assertSlaPriority("network", targets.network, targets));
  assert.throws(() => assertSlaPriority("network", { firstResponseMinutes: 61, resolutionMinutes: 240 }, targets));
  assert.throws(() => assertSlaPriority("billing", { firstResponseMinutes: 10, resolutionMinutes: 200 }, targets));
});
