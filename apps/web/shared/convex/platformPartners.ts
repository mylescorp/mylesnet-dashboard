import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type PartnerType = "agency" | "reseller";
export type PartnerStatus = "active" | "suspended";
export type PlatformPartner = {
  id: string; type: PartnerType; status: PartnerStatus;
  parent: { id: string; name: string; slug: string; status: string } | null;
  partner: { id: string; name: string; slug: string; status: string } | null;
  createdAt: number; updatedAt: number; archived: boolean;
};
export type PartnerTenantOption = { id: string; name: string; slug: string; status: string };
type PageArgs = { paginationOpts: { numItems: number; cursor: string | null } };
export const platformPartners = {
  list: makeFunctionReference<"query", PageArgs & { type: PartnerType; includeArchived?: boolean }, PaginationResult<PlatformPartner>>("platformPartners:list"),
  get: makeFunctionReference<"query", { id: string }, PlatformPartner | null>("platformPartners:get"),
  tenantOptions: makeFunctionReference<"query", PageArgs, PaginationResult<PartnerTenantOption>>("platformPartners:tenantOptions"),
  create: makeFunctionReference<"mutation", { type: PartnerType; parentTenantId: string; childTenantId: string }, string>("platformPartners:create"),
  update: makeFunctionReference<"mutation", { id: string; parentTenantId?: string; childTenantId?: string }, { updated: true }>("platformPartners:update"),
  archive: makeFunctionReference<"mutation", { id: string }, { archived: true }>("platformPartners:archive"),
  suspend: makeFunctionReference<"mutation", { id: string; reason: string }, { suspended: true; affectedRelationships: number }>("platformPartners:suspend"),
  restore: makeFunctionReference<"mutation", { id: string; reason: string }, { restored: true; affectedRelationships: number }>("platformPartners:restore"),
};
