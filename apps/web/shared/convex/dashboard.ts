import { makeFunctionReference } from "convex/server";

/** Live, tenant-scoped dashboard metrics (see convex/dashboard.ts). */
export type DashboardMetrics = {
  revenueToday: number;
  revenueTodayCount: number;
  currency: string;
  activeSubscriptions: number;
  newSignupsToday: number;
  openTickets: number;
  activeMarkets: number;
};

export type SetupChecklistItem = {
  key: string;
  label: string;
  href: string;
  done: boolean;
};

export type SetupStatus = {
  firstName: string;
  items: SetupChecklistItem[];
  completedSteps: number;
  totalSteps: number;
};

/**
 * Explicit reference while the generated Convex API stays pinned to the last
 * approved deployment — keep in sync with convex/dashboard.ts.
 */
export const dashboard = {
  getMetrics: makeFunctionReference<"query", Record<string, never>, DashboardMetrics>(
    "dashboard:getMetrics",
  ),
  getSetupStatus: makeFunctionReference<"query", Record<string, never>, SetupStatus>(
    "dashboard:getSetupStatus",
  ),
};