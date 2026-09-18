import { makeFunctionReference } from "convex/server";

/**
 * Client-side bindings for platform-specific functions that live in
 * `convex/markets.ts` but are not yet in the pinned generated `api`.
 * Keep in sync — never regenerate bindings until the Convex target is
 * explicitly verified.
 */

export const platformMarkets = {
  listMarkets: makeFunctionReference<"query", {
    tenantId?: string;
    lifecycleStatus?: "planned" | "active" | "paused" | "decommissioned";
    limit?: number;
  }, any>("convex.markets.platformListMarkets"),
  
  getMarket: makeFunctionReference<"query", {
    marketId: string;
  }, any>("convex.markets.platformGetMarket"),
  
  createMarket: makeFunctionReference<"mutation", {
    tenantId: string;
    name: string;
    country: string;
    currency: string;
  }, string>("convex.markets.platformCreateMarket"),
  
  updateMarket: makeFunctionReference<"mutation", {
    marketId: string;
    updates: {
      name?: string;
      country?: string;
      currency?: string;
      lifecycleStatus?: "planned" | "active" | "paused" | "decommissioned";
    };
  }, string>("convex.markets.platformUpdateMarket"),
  
  softDeleteMarket: makeFunctionReference<"mutation", {
    marketId: string;
    deleteReason: string;
    forceCascade?: boolean;
  }, string>("convex.markets.platformSoftDeleteMarket"),
  
  restoreMarket: makeFunctionReference<"mutation", {
    marketId: string;
  }, string>("convex.markets.platformRestoreMarket"),
};