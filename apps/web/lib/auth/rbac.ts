/**
 * RBAC helpers for the web layer (pure, node/browser-safe).
 *
 * These helpers are optimistic UI-side checks on the WorkOS access-token
 * claims (`roles`, `permissions`). The authoritative checks stay in Convex
 * (`convex/lib/auth.ts`, `convex/lib/permissions.ts`) — never gate a mutation
 * on these alone.
 */

/** Panel names (canonical map, 99-mylesnet-orientation). */
export type PanelName = "platform" | "network" | "dashboard" | "reseller" | "agency" | "partner";

/**
 * Role-slug prefix -> panel(s). `agent` currently maps the pre-migration
 * single-dashboard estate; multi-panel roles land with Phase 2/5-6.
 */
export const PANEL_ROLE_PREFIXES: Record<PanelName, string[]> = {
  platform: ["platform"],
  network: ["network", "super_admin", "admin_ops"],
  dashboard: ["agent", "dashboard", "tenant", "sales"],
  reseller: ["reseller"],
  agency: ["agency"],
  partner: ["partner"],
};

const PANEL_PREFIX_LOOKUP: ReadonlyMap<string, PanelName> = new Map(
  (Object.entries(PANEL_ROLE_PREFIXES) as Array<[PanelName, string[]]>).flatMap(
    ([panel, prefixes]) => prefixes.map((prefix) => [prefix, panel]),
  ),
);

/** Panel name whose role prefixes include the given role slug, if any. */
export function panelForRole(roleSlug: string): PanelName | null {
  for (const prefix of PANEL_PREFIX_LOOKUP.keys()) {
    if (roleSlug === prefix || roleSlug.startsWith(`${prefix}_`) || roleSlug.startsWith(`${prefix}:`)) {
      return PANEL_PREFIX_LOOKUP.get(prefix) ?? null;
    }
  }
  return null;
}

/** True when any held role maps to the given panel. */
export function roleMatchesPanel(roleSlugs: string[], panel: PanelName): boolean {
  return roleSlugs.some((slug) => panelForRole(slug) === panel);
}

/** True when the user holds every required role. */
export function hasRole(roleSlugs: string[], requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.every((role) => roleSlugs.includes(role));
}

/** True when the user holds at least one of the required roles. */
export function hasAnyRole(roleSlugs: string[], requiredRoles: string[]): boolean {
  if (requiredRoles.length === 0) return true;
  return requiredRoles.some((role) => roleSlugs.includes(role));
}

/** True when every required permission is present in the token claims. */
export function hasPermission(permissions: string[], requiredPermissions: string[]): boolean {
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.every((permission) => permissions.includes(permission));
}

/** True when at least one required permission is present. */
export function hasAnyPermission(permissions: string[], requiredPermissions: string[]): boolean {
  if (requiredPermissions.length === 0) return true;
  return requiredPermissions.some((permission) => permissions.includes(permission));
}

/** Flatten a WorkOS `roles`/`permissions` claim (array of strings) to string[]. */
export function toClaimArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((entry): entry is string => typeof entry === "string");
  if (typeof value === "string") return [value];
  return [];
}

/** Flatten org-scoped role claims shaped `{ [orgId]: string[] }` into one list. */
export function flattenOrgScopedRoles(value: unknown): string[] {
  if (typeof value === "object" && value !== null) {
    return Object.values(value as Record<string, unknown>).flatMap(toClaimArray);
  }
  return toClaimArray(value);
}

/** True when any held role is a platform staff role (platform_*). */
export function isPlatformStaff(roleSlugs: string[]): boolean {
  return roleSlugs.some((slug) => slug === "platform" || slug.startsWith("platform_") || slug.startsWith("platform:"));
}