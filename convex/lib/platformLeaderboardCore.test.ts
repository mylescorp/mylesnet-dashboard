import { test } from "node:test";
import assert from "node:assert/strict";
import { aggregateTenantLeaderboard } from "./platformLeaderboardCore.ts";

test("platform leaderboard aggregates markets into tenant-only rankings", () => {
  const rows = [
    { tenantId: "a", tenantName: "Alpha", date: "2026-10-01", revenueUSD: 2.111, salesCount: 1, newSubscribers: 2 },
    { tenantId: "a", tenantName: "Alpha", date: "2026-10-01", revenueUSD: 3.229, salesCount: 4, newSubscribers: 1 },
    { tenantId: "b", tenantName: "Beta", date: "2026-10-01", revenueUSD: 8, salesCount: 1, newSubscribers: 1 },
  ];
  const ranking = aggregateTenantLeaderboard(rows, "newSubscribers");
  assert.deepEqual(ranking.map(({ tenantId, rank, score }) => ({ tenantId, rank, score })), [
    { tenantId: "a", rank: 1, score: 3 },
    { tenantId: "b", rank: 2, score: 1 },
  ]);
  assert.equal(ranking[0]?.revenueUSD, 5.34);
  assert.equal(ranking[0]?.salesCount, 5);
  assert.equal("marketId" in (ranking[0] ?? {}), false);
});

test("leaderboard tie ordering is stable and malformed measures are excluded", () => {
  const ranking = aggregateTenantLeaderboard([
    { tenantId: "z", tenantName: "Same", date: "2026-10-01", revenueUSD: 2, salesCount: 1, newSubscribers: 1 },
    { tenantId: "a", tenantName: "Same", date: "2026-10-01", revenueUSD: 2, salesCount: 1, newSubscribers: 1 },
    { tenantId: "bad", tenantName: "Bad", date: "2026-10-01", revenueUSD: Number.NaN, salesCount: 9, newSubscribers: 9 },
  ], "revenueUSD");
  assert.deepEqual(ranking.map((row) => row.tenantId), ["a", "z"]);
});
