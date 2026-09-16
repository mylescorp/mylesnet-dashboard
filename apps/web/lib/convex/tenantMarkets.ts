import { makeFunctionReference } from "convex/server";

export type MarketLifecycleStatus = "planned" | "active" | "paused" | "decommissioned";

export type TenantMarket = {
  _id: string;
  name: string;
  country: string;
  currency: string;
  lifecycleStatus: MarketLifecycleStatus;
  status: string;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
  deletedBy: string | null;
  deleteReason: string | null;
  restoredAt: number | null;
  restoredBy: string | null;
};

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const tenantMarkets = {
  listForTenant: makeFunctionReference<"query", { tenantId: string }, TenantMarket[]>("tenantMarkets:listForTenant"),
  getForTenant: makeFunctionReference<"query", { tenantId: string; marketId: string }, TenantMarket>("tenantMarkets:getForTenant"),
  createForTenant: makeFunctionReference<"mutation", { tenantId: string; name: string; country: string; currency: string }, string>("tenantMarkets:createForTenant"),
  updateForTenant: makeFunctionReference<"mutation", {
    tenantId: string;
    marketId: string;
    name?: string;
    country?: string;
    currency?: string;
  }, string>("tenantMarkets:updateForTenant"),
  setLifecycleForTenant: makeFunctionReference<"mutation", {
    tenantId: string;
    marketId: string;
    lifecycleStatus: MarketLifecycleStatus;
  }, string>("tenantMarkets:setLifecycleForTenant"),
  softDeleteForTenant: makeFunctionReference<"mutation", {
    tenantId: string;
    marketId: string;
    deleteReason: string;
    forceCascade?: boolean;
  }, string>("tenantMarkets:softDeleteForTenant"),
  restoreForTenant: makeFunctionReference<"mutation", { tenantId: string; marketId: string }, string>("tenantMarkets:restoreForTenant"),
};