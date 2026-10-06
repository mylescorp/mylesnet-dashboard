import { makeFunctionReference } from "convex/server";

export type PlatformMarket = { _id: string; name: string; country: string; currency: string; lifecycleStatus: "planned" | "active" | "paused" | "decommissioned"; status: string; createdAt: number };
export const platformMarkets = {
  listForTenant: makeFunctionReference<"query", { tenantId: string; includeArchived?: boolean }, PlatformMarket[]>("platformMarkets:listForTenant"),
  createForTenant: makeFunctionReference<"mutation", { tenantId: string; name: string; country: string; currency: string }, string>("platformMarkets:createForTenant"),
  setLifecycle: makeFunctionReference<"mutation", { tenantId: string; marketId: string; lifecycleStatus: PlatformMarket["lifecycleStatus"] }, void>("platformMarkets:setLifecycle"),
  updateForTenant: makeFunctionReference<"mutation", { tenantId: string; marketId: string; name: string; country: string; currency: string }, void>("platformMarkets:updateForTenant"),
  softDeleteForTenant: makeFunctionReference<"mutation", { tenantId: string; marketId: string; reason: string }, void>("platformMarkets:softDeleteForTenant"),
  restoreForTenant: makeFunctionReference<"mutation", { tenantId: string; marketId: string }, void>("platformMarkets:restoreForTenant"),
};
