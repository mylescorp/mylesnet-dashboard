import { hasAnyRole } from "../auth/rbac.ts";

const platformRoles = {
  superAdmin: ["platform_super_admin", "platform_owner"],
  ops: ["platform_ops", "ops_manager"],
  finance: ["platform_finance", "finance_manager"],
  support: ["platform_support"],
  readonly: ["platform_readonly"],
};

/** Explicit routes whose canonical matrix denies at least one platform sub-role. */
export const PLATFORM_NAV_ROLE_SCOPES: Readonly<Record<string, readonly string[]>> = {
  "/platform": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/health": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/organizations": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/organizations/[id]": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/organizations/[id]/markets": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/organizations/new": [...platformRoles.superAdmin, ...platformRoles.ops],
  "/platform/organizations/[id]/suspend": [...platformRoles.superAdmin, ...platformRoles.ops],
  "/platform/organizations/[id]/restore": [...platformRoles.superAdmin, ...platformRoles.ops],
  "/platform/subscriptions": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/billing": [...platformRoles.superAdmin, ...platformRoles.finance, ...platformRoles.readonly],
  "/platform/billing/plans": [...platformRoles.superAdmin, ...platformRoles.finance, ...platformRoles.ops, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/billing/reconciliation": [...platformRoles.superAdmin, ...platformRoles.finance, ...platformRoles.ops],
  "/platform/billing/anomalies": [...platformRoles.superAdmin, ...platformRoles.finance, ...platformRoles.ops],
  "/platform/commissions": [...platformRoles.superAdmin, ...platformRoles.finance, ...platformRoles.ops],
  "/platform/commissions/rates": [...platformRoles.superAdmin, ...platformRoles.finance],
  "/platform/commissions/payouts": [...platformRoles.superAdmin, ...platformRoles.finance],
  "/platform/analytics": [...platformRoles.superAdmin, ...platformRoles.finance, ...platformRoles.ops, ...platformRoles.readonly],
  "/platform/analytics/leaderboard": [...platformRoles.superAdmin, ...platformRoles.readonly],
  "/platform/analytics/scheduled-reports": [...platformRoles.superAdmin, ...platformRoles.finance],
  "/platform/analytics/tenant-health": [...platformRoles.superAdmin, ...platformRoles.support],
  "/platform/infrastructure/devices": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/infrastructure/devices/[deviceId]": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/infrastructure/health": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/infrastructure/radius": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/infrastructure/provisioning-queue": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/infrastructure/policy-templates": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/vouchers/packages": [...platformRoles.superAdmin, ...platformRoles.ops],
  "/platform/vouchers/monitor": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance],
  "/platform/agencies": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support],
  "/platform/resellers": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support],
  "/platform/support": [...platformRoles.superAdmin, ...platformRoles.support, ...platformRoles.ops, ...platformRoles.finance],
  "/platform/support/sla": [...platformRoles.superAdmin, ...platformRoles.support],
  "/platform/access": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/users/directory": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/audit": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/audit-log": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/security": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/api-keys": [...platformRoles.superAdmin, ...platformRoles.ops],
  "/platform/security/data-requests": [...platformRoles.superAdmin, ...platformRoles.support],
  "/platform/settings/white-label": [...platformRoles.superAdmin],
  "/platform/settings": [...platformRoles.superAdmin, ...platformRoles.ops],
  "/platform/feature-flags": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
};

export function canSeePlatformNavRoute(href: string, roleSlugs: string[], fallbackRoles?: string[]): boolean {
  const requiredRoles = PLATFORM_NAV_ROLE_SCOPES[href] ?? fallbackRoles;
  // A new platform route must opt into an explicit role scope before it can
  // appear in navigation. This keeps spec-silent role cells denied by default.
  return requiredRoles !== undefined && hasAnyRole(roleSlugs, [...requiredRoles]);
}
