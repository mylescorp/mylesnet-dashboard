import { makeFunctionReference } from "convex/server";

export type PlatformRevenueRollup = {
  currency: "KES";
  mrrMinor: number;
  arrMinor: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  unpricedActiveTenants: number;
};

export type PlatformRevenueSnapshot = PlatformRevenueRollup & { _id: string; snapshotDate: string; generatedAt: number };
export type PlatformRevenueDashboard = { current: PlatformRevenueRollup; snapshots: PlatformRevenueSnapshot[] };

export const platformRevenue = {
  getDashboard: makeFunctionReference<"query", { days?: number }, PlatformRevenueDashboard>("platformRevenue:getDashboard"),
};
