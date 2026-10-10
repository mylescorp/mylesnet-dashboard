import { makeFunctionReference } from "convex/server";

export type PlatformAnalyticsDay = {
  date: string;
  revenueUSD: number;
  salesCount: number;
  newSubscribers: number;
  averageReportedUptime: number | null;
  uptimeMarketSamples: number;
  activeAlerts: number | null;
  alertMarketSamples: number;
  marketsReporting: number;
};

export type PlatformAnalyticsDashboard = {
  days: number;
  series: PlatformAnalyticsDay[];
  totals: Omit<PlatformAnalyticsDay, "date" | "uptimeMarketSamples" | "alertMarketSamples"> & { latestSnapshotDate: string | null };
};

export const platformAnalytics = {
  getDashboard: makeFunctionReference<"query", { days?: number }, PlatformAnalyticsDashboard>("platformAnalytics:getDashboard"),
};
