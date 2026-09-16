/**
 * Server-route panel access policy.
 *
 * The WorkOS environment contains both system-role slugs and historical
 * organization-role slugs. Keep the compatibility map explicit while the
 * Phase 2 three-scope migration is completed; this is an access gate, never
 * a substitute for Convex tenant authorization.
 */
export const PANEL_ROLE_REQUIREMENTS = {
  platform: [
    "platform_super_admin",
    "platform_ops",
    "platform_finance",
    "platform_readonly",
    "platform_owner",
    "platform_admin",
    "platform_support",
    "org-platform_owner",
    "org-platform_admin",
    "org-platform_support",
  ],
  admin: ["client_admin", "tenant_admin", "org-client_admin", "org-tenant_admin"],
  network: [
    "network_owner",
    "network_admin",
    "network_operator",
    "platform_owner",
    "platform_admin",
    "org-network_owner",
    "org-network_admin",
    "org-network_operator",
    "org-platform_owner",
    "org-platform_admin",
  ],
  dashboard: [
    "client_admin",
    "tenant_admin",
    "tenant_manager",
    "tenant_operator",
    "agent",
    "dashboard",
    "tenant",
    "sales",
    "finance",
    "noc",
    "viewer",
    "org-client_admin",
    "org-tenant_admin",
    "org-tenant_manager",
    "org-tenant_operator",
  ],
  reseller: ["reseller", "org-reseller"],
  agency: ["agency", "org-agency"],
  partner: ["partner", "org-partner"],
} as const;

export type ProtectedPanel = keyof typeof PANEL_ROLE_REQUIREMENTS;

export function hasPanelAccess(roleSlugs: readonly string[], panel: ProtectedPanel): boolean {
  return PANEL_ROLE_REQUIREMENTS[panel].some((role) => roleSlugs.includes(role));
}

/**
 * Select a safe destination when an authenticated user reaches a panel that
 * their current organization role cannot enter. Platform staff must never be
 * treated as members of an arbitrary tenant workspace.
 */
export function panelAccessFallback(roleSlugs: readonly string[], panel: ProtectedPanel): string {
  if (panel !== "platform" && hasPanelAccess(roleSlugs, "platform")) {
    return "/platform?reason=tenant_workspace_required";
  }

  return "/no-access";
}
