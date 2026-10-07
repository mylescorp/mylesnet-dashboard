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

export function canManagePlatformTenants(
  roleSlugs: readonly string[] | undefined,
): boolean {
  return roleSlugs?.some((slug) => TENANT_OPERATIONS_ROLES.has(slug)) ?? false;
}

export function canDeletePlatformTenant(roleSlugs: readonly string[] | undefined): boolean {
  return roleSlugs?.some((slug) => PLATFORM_SUPER_ADMIN_ROLES.has(slug)) ?? false;
}

export function canManagePlatformPlans(roleSlugs: readonly string[] | undefined): boolean {
  return roleSlugs?.some((slug) => PLATFORM_PLAN_MANAGEMENT_ROLES.has(slug)) ?? false;
}
