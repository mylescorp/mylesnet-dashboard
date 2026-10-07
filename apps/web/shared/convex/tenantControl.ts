import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type TenantStatus = "provisioning" | "trial" | "active" | "suspended" | "pending_deletion" | "cancelled";

export type EntitlementStatus = "trial" | "active" | "expired" | "suspended";

type EntitlementSummary = { planId: string; status: EntitlementStatus; startsAt: number | null; expiresAt: number | null; trialEndsAt: number | null } | null;

export type PlatformTenant = {
  _id: string;
  name: string;
  slug: string;
  country: string;
  timezone: string;
  currency: string;
  status: TenantStatus;
  scheduledDeletionAt: number | null;
  workosOrganizationId: string | null;
  membershipCount: number;
  accountOwner: { name: string | null; email: string | null } | null;
  marketCount: number;
  subscriberCount: number;
  entitlement: EntitlementSummary;
  createdAt: number;
};

export type TenantWorkspace = {
  tenant: {
    _id: string;
    name: string;
    slug: string;
    status: TenantStatus;
    country: string;
    timezone: string;
    currency: string;
  };
  activeMembers: number;
  activeMarkets: number;
  entitlement: { planId: string; status: string } | null;
};

export type TenantWorkspaceSetupReason =
  | "authentication_required"
  | "tenant_unconfigured"
  | "tenant_unavailable"
  | "tenant_suspended"
  | "account_inactive"
  | "tenant_membership_required";

export type TenantWorkspaceResult =
  | { status: "ready"; workspace: TenantWorkspace }
  | { status: "setup_required"; reason: TenantWorkspaceSetupReason };

export type SubscriptionTenant = Pick<PlatformTenant, "_id" | "name" | "slug" | "country" | "status" | "entitlement">;
export type PlatformOverview = {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  pendingDeletion: number;
  missingIdentity: number;
  entitlementRisk: number;
  latest: Array<Pick<PlatformTenant, "_id" | "name" | "slug" | "country" | "status" | "workosOrganizationId" | "entitlement">>;
};

export type TenantDetailMember = {
  userId: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role: string;
  status: "active" | "pending" | "revoked";
  joinedAt: number | null;
};

export type TenantDetail = {
  _id: string;
  name: string;
  slug: string;
  country: string;
  timezone: string;
  currency: string;
  status: TenantStatus;
  statusBeforeSuspension: "trial" | "active" | null;
  scheduledDeletionAt: number | null;
  deletionReason: string | null;
  workosOrganizationId: string | null;
  createdAt: number;
  updatedAt: number;
  entitlement: {
    planId: string;
    status: EntitlementStatus;
    startsAt: number | null;
    expiresAt: number | null;
    trialEndsAt: number | null;
  } | null;
  activeMemberCount: number;
  marketCount: number;
  subscriberCount: number;
  members: TenantDetailMember[];
};

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const tenantControl = {
  listForPlatform: makeFunctionReference<"query", Record<string, never>, PlatformTenant[]>("tenantControl:listForPlatform"),
  listForPlatformPage: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null } }, PaginationResult<PlatformTenant>>("tenantControl:listForPlatformPage"),
  listSubscriptionsPage: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null } }, PaginationResult<SubscriptionTenant>>("tenantControl:listSubscriptionsPage"),
  listPlatformTenantTargets: makeFunctionReference<"query", Record<string, never>, Array<{ _id: string; name: string }>>("tenantControl:listPlatformTenantTargets"),
  listPlatformTenantTargetsPage: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null } }, PaginationResult<{ _id: string; name: string }>>("tenantControl:listPlatformTenantTargetsPage"),
  getPlatformOverview: makeFunctionReference<"query", Record<string, never>, PlatformOverview>("tenantControl:getPlatformOverview"),
  getCurrentWorkspace: makeFunctionReference<"query", Record<string, never>, TenantWorkspaceResult>("tenantControl:getCurrentWorkspace"),
  setStatus: makeFunctionReference<"mutation", { tenantId: string; status: "active" | "suspended" }, { changed: boolean; status: TenantStatus }>("tenantControl:setStatus"),
  scheduleDeletion: makeFunctionReference<"mutation", { tenantId: string; reason: string }, { scheduledDeletionAt: number }>("tenantControl:scheduleDeletion"),
  restoreScheduledDeletion: makeFunctionReference<"mutation", { tenantId: string }, { restored: boolean; status: TenantStatus }>("tenantControl:restoreScheduledDeletion"),
  updateTenant: makeFunctionReference<"mutation", { tenantId: string; name: string; country: string; timezone: string; currency: string }, { updated: boolean }>("tenantControl:updateTenant"),
  getTenantDetail: makeFunctionReference<"query", { tenantId: string }, TenantDetail | null>("tenantControl:getTenantDetail"),
  setEntitlement: makeFunctionReference<"mutation", {
    tenantId: string;
    planId: string;
    status: EntitlementStatus;
    startsAt?: number;
    expiresAt?: number;
    trialEndsAt?: number;
  }, { changed: boolean }>("tenantControl:setEntitlement"),
  removeEntitlement: makeFunctionReference<"mutation", { tenantId: string; reason: string }, { removed: boolean }>("tenantControl:removeEntitlement"),
  provisionTenant: makeFunctionReference<"action", {
    name: string;
    slug: string;
    country: string;
    timezone: string;
    currency: string;
    ownerEmail: string;
    ownerName?: string;
  }, { tenantId: string; status: "ready" } | { status: "authentication_required" | "unavailable" }>("tenantControl:provisionTenant"),
};
