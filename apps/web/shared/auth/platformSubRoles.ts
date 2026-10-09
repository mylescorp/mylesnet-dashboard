import { PLATFORM_SUB_ROLE_MAP } from "../../../../convex/lib/permissions.ts";

/** Apply the same spec-slug mapping used by Convex platform guards. */
export function hasAnyPlatformSubRole(roleSlugs: string[], allowedSubRoles: string[]): boolean {
  return allowedSubRoles.some((subRole) => {
    const mapped = PLATFORM_SUB_ROLE_MAP[subRole] ?? [subRole];
    return mapped.some((roleSlug) => roleSlugs.includes(roleSlug));
  });
}
