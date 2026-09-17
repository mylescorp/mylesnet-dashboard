import { makeFunctionReference } from "convex/server";

export type TenantStatus = "provisioning" | "trial" | "active" | "suspended" | "cancelled";

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
  workosOrganizationId: string | null;
  membershipCount: number;
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
  | "account_inactive"
  | "tenant_membership_required";

export type TenantWorkspaceResult =
  | { status: "ready"; workspace: TenantWorkspace }
  | { status: "setup_required"; reason: TenantWorkspaceSetupReason };

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
  members: TenantDetailMember[];
};

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const tenantControl = {
  listForPlatform: makeFunctionReference<"query", Record<string, never>, PlatformTenant[]>("tenantControl:listForPlatform"),
  getCurrentWorkspace: makeFunctionReference<"query", Record<string, never>, TenantWorkspaceResult>("tenantControl:getCurrentWorkspace"),
  setStatus: makeFunctionReference<"mutation", { tenantId: string; status: TenantStatus }, { changed: boolean }>("tenantControl:setStatus"),
  getTenantDetail: makeFunctionReference<"query", { tenantId: string }, TenantDetail | null>("tenantControl:getTenantDetail"),
  setEntitlement: makeFunctionReference<"mutation", {
    tenantId: string;
    planId: string;
    status: EntitlementStatus;
    startsAt?: number;
    expiresAt?: number;
    trialEndsAt?: number;
  }, { changed: boolean }>("tenantControl:setEntitlement"),
  provisionTenant: makeFunctionReference<"action", {
    name: string;
    slug: string;
    country: string;
    timezone: string;
    currency: string;
    ownerEmail: string;
    ownerName?: string;
  }, { tenantId: string; status: "provisioning" } | { status: "authentication_required" | "security_check_required" | "unavailable" }>("tenantControl:provisionTenant"),
};
