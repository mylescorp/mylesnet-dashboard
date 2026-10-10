import { makeFunctionReference } from "convex/server";

export type TenantLeaderboardMetric = "newSubscribers" | "salesCount" | "revenueUSD";
export type TenantLeaderboardRow = {
  tenantId: string;
  tenantName: string;
  revenueUSD: number;
  salesCount: number;
  newSubscribers: number;
  snapshotDays: number;
  score: number;
  rank: number;
};
export type TenantLeaderboardResult = {
  days: 7 | 30 | 90;
  metric: TenantLeaderboardMetric;
  source: "dailySnapshots";
  latestSnapshotDate: string | null;
  snapshotRows: number;
  totalTenants: number;
  returnedTenants: number;
  ranking: TenantLeaderboardRow[];
};
export const platformLeaderboard = {
  getTenantLeaderboard: makeFunctionReference<"query", { days: 7 | 30 | 90; metric: TenantLeaderboardMetric }, TenantLeaderboardResult>("platformLeaderboard:getTenantLeaderboard"),
};
