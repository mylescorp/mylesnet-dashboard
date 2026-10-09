import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type PlatformCommissionRate = {
  id: string;
  scope: "global" | "agency";
  relationshipId: string | null;
  agencyName: string | null;
  rateBasisPoints: number;
  durationMonths: number;
  updatedAt: number;
};
export type PlatformAgencyRateOption = { id: string; name: string; status: string };
export type PlatformAgencyRatePage = PaginationResult<PlatformAgencyRateOption>;
export const platformCommissionRates = {
  getGlobal: makeFunctionReference<"query", Record<string, never>, PlatformCommissionRate>("platformCommissionRates:getGlobal"),
  listOverrides: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null } }, PaginationResult<PlatformCommissionRate>>("platformCommissionRates:listOverrides"),
  agencyOptions: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null } }, PlatformAgencyRatePage>("platformCommissionRates:agencyOptions"),
  create: makeFunctionReference<"mutation", { scope: "global" | "agency"; relationshipId?: string; rateBasisPoints: number; durationMonths: number }, string>("platformCommissionRates:create"),
  saveGlobal: makeFunctionReference<"mutation", { rateBasisPoints: number; durationMonths: number }, string>("platformCommissionRates:saveGlobal"),
  update: makeFunctionReference<"mutation", { id: string; rateBasisPoints: number; durationMonths: number }, { updated: boolean }>("platformCommissionRates:update"),
  remove: makeFunctionReference<"mutation", { id: string }, { deleted: boolean }>("platformCommissionRates:remove"),
};
