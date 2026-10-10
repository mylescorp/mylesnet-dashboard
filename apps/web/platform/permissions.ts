import { expandPlatformRoleAliases } from "../shared/auth/rbac.ts";

const TENANT_OPERATIONS_ROLES = new Set([
  "platform_super_admin",
  "platform_ops",
  "platform_owner",
  "platform_admin",
  "ops_manager",
]);

const PLATFORM_SUPER_ADMIN_ROLES = new Set(["platform_super_admin", "platform_owner", "platform_admin"]);
const PLATFORM_PLAN_MANAGEMENT_ROLES = new Set([
  "platform_super_admin",
  "platform_finance",
  "platform_owner",
  "platform_admin",
  "finance_manager",
]);
const PLATFORM_INFRASTRUCTURE_ROLES = new Set([
  "platform_super_admin", "platform_ops", "platform_owner", "platform_admin", "ops_manager",
]);
const PLATFORM_WHITE_LABEL_ROLES = new Set(["platform_super_admin", "platform_owner", "platform_admin"]);
const PLATFORM_PARTNER_READ_ROLES = new Set([
  "platform_super_admin", "platform_owner", "platform_admin",
  "platform_ops", "ops_manager", "platform_finance", "finance_manager", "platform_support",
]);

function hasOneOfRoles(roleSlugs: readonly string[] | undefined, allowedRoles: ReadonlySet<string>): boolean {
  if (!roleSlugs) return false;
  const effectiveRoles = expandPlatformRoleAliases(roleSlugs);
  return [...allowedRoles].some((role) => effectiveRoles.has(role));
}

export function canManagePlatformTenants(
  roleSlugs: readonly string[] | undefined,
): boolean {
  return hasOneOfRoles(roleSlugs, TENANT_OPERATIONS_ROLES);
}

export function canDeletePlatformTenant(roleSlugs: readonly string[] | undefined): boolean {
  return hasOneOfRoles(roleSlugs, PLATFORM_SUPER_ADMIN_ROLES);
}

export function canManagePlatformPlans(roleSlugs: readonly string[] | undefined): boolean {
  return hasOneOfRoles(roleSlugs, PLATFORM_PLAN_MANAGEMENT_ROLES);
}

export function canManagePlatformInfrastructure(roleSlugs: readonly string[] | undefined): boolean {
  return hasOneOfRoles(roleSlugs, PLATFORM_INFRASTRUCTURE_ROLES);
}

export function canManagePlatformWhiteLabel(roleSlugs: readonly string[] | undefined): boolean {
  return hasOneOfRoles(roleSlugs, PLATFORM_WHITE_LABEL_ROLES);
}

/** D1 grants agency/reseller reads to SA, ops, finance, and support only. */
export function canReadPlatformPartnerRegistry(roleSlugs: readonly string[] | undefined): boolean {
  return hasOneOfRoles(roleSlugs, PLATFORM_PARTNER_READ_ROLES);
}

/** D1 relationship CRUD is super-admin only. */
export function canManagePlatformPartnerRegistry(roleSlugs: readonly string[] | undefined): boolean {
  return hasOneOfRoles(roleSlugs, PLATFORM_SUPER_ADMIN_ROLES);
}
