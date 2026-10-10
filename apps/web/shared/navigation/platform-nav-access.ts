import { hasAnyRole } from "../auth/rbac.ts";

const platformRoles = {
  superAdmin: ["platform_super_admin", "platform_owner", "platform_admin"],
  ops: ["platform_ops", "ops_manager"],
  finance: ["platform_finance", "finance_manager"],
  support: ["platform_support"],
  readonly: ["platform_readonly", "readonly"],
};

/** Explicit routes whose canonical matrix denies at least one platform sub-role. */
const PLATFORM_NAV_ROLE_SCOPES: Record<string, string[]> = {
  "/platform": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/organizations": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
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
  "/platform/security": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
  "/platform/api-keys": [...platformRoles.superAdmin, ...platformRoles.ops],
  "/platform/security/data-requests": [...platformRoles.superAdmin, ...platformRoles.support],
  "/platform/settings/white-label": [...platformRoles.superAdmin],
  "/platform/feature-flags": [...platformRoles.superAdmin, ...platformRoles.ops, ...platformRoles.finance, ...platformRoles.support, ...platformRoles.readonly],
};

export function canSeePlatformNavRoute(href: string, roleSlugs: string[], fallbackRoles?: string[]): boolean {
  const requiredRoles = PLATFORM_NAV_ROLE_SCOPES[href] ?? fallbackRoles;
  return !requiredRoles || hasAnyRole(roleSlugs, requiredRoles);
}
