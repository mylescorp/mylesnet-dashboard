import assert from "node:assert/strict";
import { test } from "node:test";
import { PLATFORM_SLA_FALLBACK, ticketDeadlines } from "./platformSlaCore.ts";

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
