import { makeFunctionReference } from "convex/server";
import type { Id } from "@/convex/_generated/dataModel";

export type MarketLifecycle = "planned" | "active" | "paused" | "decommissioned";
export type PlatformMarket = {
  _id: Id<"markets">;
  name: string;
  country: string;
  currency: string;
  status: "active" | "deleted";
  lifecycleStatus: MarketLifecycle;
  createdAt: number;
};

export const platformMarkets = {
  listForTenant: makeFunctionReference<"query", { tenantId: Id<"tenants">; includeArchived?: boolean }, PlatformMarket[]>("platformMarkets:listForTenant"),
  createForTenant: makeFunctionReference<"mutation", { tenantId: Id<"tenants">; name: string; country: string; currency: string }, Id<"markets">>("platformMarkets:createForTenant"),
  updateForTenant: makeFunctionReference<"mutation", { tenantId: Id<"tenants">; marketId: Id<"markets">; name: string; country: string; currency: string }, void>("platformMarkets:updateForTenant"),
  setLifecycle: makeFunctionReference<"mutation", { tenantId: Id<"tenants">; marketId: Id<"markets">; lifecycleStatus: MarketLifecycle }, void>("platformMarkets:setLifecycle"),
  softDeleteForTenant: makeFunctionReference<"mutation", { tenantId: Id<"tenants">; marketId: Id<"markets">; reason: string }, void>("platformMarkets:softDeleteForTenant"),
  restoreForTenant: makeFunctionReference<"mutation", { tenantId: Id<"tenants">; marketId: Id<"markets"> }, void>("platformMarkets:restoreForTenant"),
};
