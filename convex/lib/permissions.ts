/**
 * Permission catalog and system role definitions for the MylesNet platform.
 *
 * The catalog is the single source of truth for every permission string used by
 * the codebase. Nav items, server guards and the role editor all derive from it.
 * Slugs align with the permission slugs already present in the WorkOS
 * environment so custom roles can reuse them when synced.
 *
 * System roles are seeded into the `roles` table and (except for the internal
 * network_operator) mirrored onto the WorkOS environment.
 */

export const PERMISSIONS = [
  { slug: "dashboard:access", name: "Dashboard", group: "Overview" },

  { slug: "routers:read", name: "View router estate", group: "Network" },
  { slug: "routers:manage", name: "Manage routers", group: "Network" },
  { slug: "devices:read", name: "View devices", group: "Network" },
  { slug: "devices:manage", name: "Manage devices", group: "Network" },
  { slug: "collector:manage", name: "Collector setup", group: "Network" },
  { slug: "config_watch:manage", name: "Config watch", group: "Network" },
  { slug: "telemetry_health:read", name: "Telemetry health", group: "Network" },
  { slug: "incidents:read", name: "View incidents", group: "Network" },
  { slug: "incidents:manage", name: "Manage incidents", group: "Network" },
  { slug: "shift_notes:manage", name: "Shift handover", group: "Network" },

  { slug: "tickets:read", name: "View support tickets", group: "Operations" },
  { slug: "tickets:manage", name: "Manage support tickets", group: "Operations" },

  { slug: "markets:read", name: "View markets", group: "Field operations" },
  { slug: "markets:manage", name: "Manage markets", group: "Field operations" },
  { slug: "prospects:read", name: "View prospects", group: "Field operations" },
  { slug: "prospects:manage", name: "Manage prospects", group: "Field operations" },
  { slug: "agents:read", name: "View agents", group: "Field operations" },
  { slug: "agents:manage", name: "Manage agents", group: "Field operations" },
  { slug: "leaderboard:read", name: "View leaderboard", group: "Field operations" },

  { slug: "business_events:read", name: "Business events feed", group: "Billing" },
  { slug: "vouchers:read", name: "View voucher stock", group: "Billing" },
  { slug: "vouchers:manage", name: "Manage vouchers", group: "Billing" },
  { slug: "vouchers:redeem", name: "Redeem vouchers", group: "Billing" },
  { slug: "commissions:read", name: "View commissions", group: "Billing" },
  { slug: "commissions:manage", name: "Manage commissions", group: "Billing" },
  { slug: "commissions:dispute", name: "Resolve commission disputes", group: "Billing" },
  { slug: "commissions:request_payout", name: "Request commission payouts", group: "Billing" },
  { slug: "usage:read", name: "Usage reports", group: "Billing" },
  { slug: "revenue:view", name: "View revenue figures", group: "Billing" },

  { slug: "users:read", name: "View account directory", group: "System" },
  { slug: "users:manage", name: "Manage user access", group: "System" },
  { slug: "roles:read", name: "View roles", group: "System" },
  { slug: "roles:manage", name: "Create and edit roles", group: "System" },
  { slug: "invitations:manage", name: "Invite team members", group: "System" },
  { slug: "organizations:read", name: "View organization overview", group: "System" },
  { slug: "audit_log:read", name: "View audit log", group: "System" },
  { slug: "comms:manage", name: "Send communications", group: "System" },
  { slug: "centipid:manage", name: "Centipid integration", group: "System" },
  { slug: "trash:manage", name: "Restore trashed records", group: "System" },
  { slug: "alerts:read", name: "View alerts", group: "System" },
  { slug: "alerts:manage", name: "Manage alerts", group: "System" },
  { slug: "compliance:access", name: "Compliance center", group: "System" },
] as const;

export type PermissionSlug = (typeof PERMISSIONS)[number]["slug"];

export const ALL_PERMISSION_SLUGS: string[] = PERMISSIONS.map((permission) => permission.slug);

export function permissionInCatalog(slug: string): boolean {
  return PERMISSIONS.some((permission) => permission.slug === slug);
}

export interface SystemRoleDefinition {
  key: string;
  name: string;
  slug: string;
  description: string;
  isSystem: true;
  isPlatform: boolean;
  /** Higher beats lower; system roles outrank custom roles. */
  rank: number;
  permissions: PermissionSlug[];
  /** Whether the role is mirrored onto the WorkOS environment. */
  syncToWorkos: boolean;
}

export const SYSTEM_ROLES: SystemRoleDefinition[] = [
  {
    key: "owner",
    name: "Platform Owner",
    slug: "platform_owner",
    description: "Full control. Everything, including role management and irreversible actions.",
    isSystem: true,
    isPlatform: true,
    rank: 400,
    permissions: ALL_PERMISSION_SLUGS as PermissionSlug[],
    syncToWorkos: true,
  },
  {
    key: "admin",
    name: "Platform Admin",
    slug: "platform_admin",
    description: "Day-to-day operations: invite users, manage access, run the business.",
    isSystem: true,
    isPlatform: true,
    rank: 300,
    permissions: ALL_PERMISSION_SLUGS.filter((permission) => permission !== "roles:manage") as PermissionSlug[],
    syncToWorkos: true,
  },
  {
    key: "support",
    name: "Platform Support",
    slug: "platform_support",
    description: "Read-only operational visibility plus ticket handling.",
    isSystem: true,
    isPlatform: true,
    rank: 200,
    permissions: [
      "dashboard:access",
      "routers:read",
      "devices:read",
      "telemetry_health:read",
      "incidents:read",
      "tickets:read",
      "tickets:manage",
      "markets:read",
      "prospects:read",
      "agents:read",
      "leaderboard:read",
      "business_events:read",
      "vouchers:read",
      "vouchers:redeem",
      "commissions:read",
      "commissions:request_payout",
      "usage:read",
      "alerts:read",
      "compliance:access",
    ],
    syncToWorkos: true,
  },
  {
    key: "agent",
    name: "Agent",
    slug: "agent",
    description: "Client-facing field role; dashboard entry only.",
    isSystem: true,
    isPlatform: false,
    rank: 100,
    permissions: ["dashboard:access", "tickets:read", "tickets:manage", "business_events:read", "compliance:access"],
    syncToWorkos: true,
  },
  {
    key: "operator",
    name: "Network Operator",
    slug: "network_operator",
    description: "Internal network operations role. Not mirrored to WorkOS.",
    isSystem: true,
    isPlatform: false,
    rank: 90,
    permissions: [
      "dashboard:access",
      "routers:read",
      "routers:manage",
      "devices:read",
      "alerts:read",
      "alerts:manage",
      "incidents:read",
      "incidents:manage",
      "shift_notes:manage",
      "usage:read",
      "collector:manage",
      "config_watch:manage",
      "telemetry_health:read",
      "business_events:read",
      "compliance:access",
    ],
    syncToWorkos: false,
  },
];

export const SYSTEM_ROLE_SLUGS: Record<string, string> = {
  owner: "platform_owner",
  admin: "platform_admin",
  support: "platform_support",
  agent: "agent",
  operator: "network_operator",
};

/** Residual platformRole mirror values that map onto system roles. */
export const PLATFORM_ROLE_TO_SYSTEM_SLUG: Record<string, string> = {
  platform_owner: "platform_owner",
  platform_admin: "platform_admin",
  platform_support: "platform_support",
  agent: "agent",
};

const SYSTEM_BY_SLUG: Record<string, SystemRoleDefinition> = {};
for (const role of SYSTEM_ROLES) {
  SYSTEM_BY_SLUG[role.slug] = role;
}

export function getSystemRoleBySlug(slug: string): SystemRoleDefinition | null {
  return SYSTEM_BY_SLUG[slug] ?? null;
}

/** WorkOS slug emitted on an organization membership for a local role. */
export function workosSlugForRole(role: { isSystem: boolean; slug: string }): string {
  return role.isSystem ? role.slug : `org-${role.slug}`;
}

/** Default rank for a new custom role (under all system roles). */
export const CUSTOM_ROLE_DEFAULT_RANK = 60;