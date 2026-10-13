export function resolveAllowedRoleSlugs(
  allowedSubRoles: string[],
  subRoleMap: Record<string, string[]>,
): string[] {
  return allowedSubRoles
    .flatMap((subRole) => subRoleMap[subRole] ?? [subRole])
    .filter((slug, index, all) => all.indexOf(slug) === index);
}

export function hasAllowedRole(userRoleSlugs: string[], allowedRoleSlugs: string[]): boolean {
  return allowedRoleSlugs.some((allowed) => userRoleSlugs.includes(allowed));
}

/** The legacy day-to-day platform administrator is not a super-admin alias. */
export function hasCanonicalPlatformSuperAdminRole(roleSlugs: readonly string[]): boolean {
  return roleSlugs.includes("platform_owner");
}
