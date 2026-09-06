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

  { slug: "routers:read", name: "View router estate", group: "Operations" },
  { slug: "routers:manage", name: "Manage routers", group: "Operations" },
  { slug: "devices:read", name: "View devices", group: "Operations" },
  { slug: "devices:manage", name: "Manage devices", group: "Operations" },
  { slug: "collector:manage", name: "Collector setup", group: "Operations" },
  { slug: "config_watch:manage", name: "Config watch", group: "Operations" },
  { slug: "telemetry_health:read", name: "Telemetry health", group: "Operations" },
  { slug: "incidents:read", name: "View incidents", group: "Operations" },
  { slug: "incidents:manage", name: "Manage incidents", group: "Operations" },
  { slug: "shift_notes:manage", name: "Shift handover", group: "Operations" },
  { slug: "maintenance:manage", name: "Maintenance windows", group: "Operations" },
  { slug: "capacity:read", name: "Capacity planning", group: "Performance" },
  { slug: "site_kit:read", name: "Site kit catalog", group: "Operations" },
  { slug: "site_kit:manage", name: "Manage site kit", group: "Operations" },

  { slug: "tickets:read", name: "View support tickets", group: "Operations" },
  { slug: "tickets:manage", name: "Manage support tickets", group: "Operations" },

  { slug: "markets:read", name: "View markets", group: "Operations" },
  { slug: "markets:manage", name: "Manage markets", group: "Operations" },
  { slug: "prospects:read", name: "View prospects", group: "Operations" },
  { slug: "prospects:manage", name: "Manage prospects", group: "Operations" },
  { slug: "agents:read", name: "View agents", group: "People" },
  { slug: "agents:manage", name: "Manage agents", group: "People" },
  { slug: "leaderboard:read", name: "View leaderboard", group: "Performance" },
  { slug: "teams:read", name: "View teams", group: "People" },
  { slug: "teams:manage", name: "Manage teams", group: "People" },
  { slug: "subscriber_snapshots:read", name: "Subscriber snapshots", group: "Business" },

  { slug: "business_events:read", name: "Business events feed", group: "Business" },
  { slug: "vouchers:read", name: "View voucher stock", group: "Business" },
  { slug: "vouchers:manage", name: "Manage vouchers", group: "Business" },
  { slug: "vouchers:redeem", name: "Redeem vouchers", group: "Business" },
  { slug: "commissions:read", name: "View commissions", group: "Finance" },
  { slug: "commissions:manage", name: "Manage commissions", group: "Finance" },
  { slug: "commissions:dispute", name: "Resolve commission disputes", group: "Finance" },
  { slug: "commissions:request_payout", name: "Request commission payouts", group: "Finance" },
  { slug: "usage:read", name: "Usage reports", group: "Reporting" },
  { slug: "revenue:view", name: "View revenue figures", group: "Business" },
  { slug: "plans:read", name: "View plans", group: "Business" },
  { slug: "plans:manage", name: "Manage plans", group: "Business" },
  { slug: "expenses:read", name: "View expenses", group: "Finance" },
  { slug: "expenses:manage", name: "Manage expenses", group: "Finance" },
  { slug: "payouts:read", name: "View payouts", group: "Finance" },
  { slug: "payouts:manage", name: "Approve payouts", group: "Finance" },
  { slug: "financials:read", name: "View market financials", group: "Finance" },
  { slug: "analytics:read", name: "Analytics", group: "Performance" },
  { slug: "risk_center:read", name: "Risk center", group: "Performance" },

  { slug: "users:read", name: "View account directory", group: "Administration" },
  { slug: "users:manage", name: "Manage user access", group: "Administration" },
  { slug: "roles:read", name: "View roles", group: "Administration" },
  { slug: "roles:manage", name: "Create and edit roles", group: "Administration" },
  { slug: "invitations:manage", name: "Invite team members", group: "Administration" },
  { slug: "organizations:read", name: "View organization overview", group: "Administration" },
  { slug: "audit_log:read", name: "View audit log", group: "Administration" },
  { slug: "comms:manage", name: "Send communications", group: "Administration" },
  { slug: "centipid:manage", name: "Centipid integration", group: "Administration" },
  { slug: "trash:manage", name: "Restore trashed records", group: "Administration" },
  { slug: "alerts:read", name: "View alerts", group: "Administration" },
  { slug: "alerts:manage", name: "Manage alerts", group: "Administration" },
  { slug: "compliance:access", name: "Compliance center", group: "Administration" },

  { slug: "reports:read", name: "View reports", group: "Reporting" },
  { slug: "reports:generate", name: "Generate report exports", group: "Reporting" },
  { slug: "investors:read", name: "View investors", group: "Reporting" },
  { slug: "investors:manage", name: "Manage investors", group: "Reporting" },
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
    key: "member",
    name: "Member",
    slug: "member",
    description: "Default organization member with basic dashboard access.",
    isSystem: true,
    isPlatform: true,
    rank: 50,
    permissions: ["dashboard:access", "business_events:read", "compliance:access"],
    syncToWorkos: true,
  },
  {
    key: "ops_manager",
    name: "Operations Manager",
    slug: "ops_manager",
    description: "Network operations lead: estate, alerts, maintenance, teams and site kit.",
    isSystem: true,
    isPlatform: true,
    rank: 290,
    permissions: [
      "dashboard:access",
      "routers:read",
      "routers:manage",
      "devices:read",
      "devices:manage",
      "collector:manage",
      "config_watch:manage",
      "telemetry_health:read",
      "incidents:read",
      "incidents:manage",
      "shift_notes:manage",
      "maintenance:manage",
      "capacity:read",
      "site_kit:read",
      "site_kit:manage",
      "tickets:read",
      "tickets:manage",
      "markets:read",
      "markets:manage",
      "prospects:read",
      "prospects:manage",
      "agents:read",
      "agents:manage",
      "leaderboard:read",
      "teams:read",
      "teams:manage",
      "subscriber_snapshots:read",
      "business_events:read",
      "vouchers:read",
      "usage:read",
      "users:read",
      "alerts:read",
      "alerts:manage",
      "analytics:read",
      "risk_center:read",
      "compliance:access",
    ],
    syncToWorkos: true,
  },
  {
    key: "finance_manager",
    name: "Finance Manager",
    slug: "finance_manager",
    description: "Owns money: expenses, payouts, financials, plans, reports and investor ops.",
    isSystem: true,
    isPlatform: true,
    rank: 280,
    permissions: [
      "dashboard:access",
      "business_events:read",
      "vouchers:read",
      "vouchers:manage",
      "vouchers:redeem",
      "commissions:read",
      "commissions:manage",
      "commissions:dispute",
      "commissions:request_payout",
      "usage:read",
      "revenue:view",
      "plans:read",
      "plans:manage",
      "expenses:read",
      "expenses:manage",
      "payouts:read",
      "payouts:manage",
      "financials:read",
      "analytics:read",
      "risk_center:read",
      "subscriber_snapshots:read",
      "markets:read",
      "agents:read",
      "leaderboard:read",
      "reports:read",
      "reports:generate",
      "investors:read",
      "investors:manage",
      "compliance:access",
    ],
    syncToWorkos: true,
  },
  {
    key: "market_manager",
    name: "Market Manager",
    slug: "market_manager",
    description: "Runs one to several markets end-to-end, scoped by market membership.",
    isSystem: true,
    isPlatform: true,
    rank: 270,
    permissions: [
      "dashboard:access",
      "routers:read",
      "devices:read",
      "telemetry_health:read",
      "alerts:read",
      "alerts:manage",
      "incidents:read",
      "incidents:manage",
      "maintenance:manage",
      "capacity:read",
      "site_kit:read",
      "tickets:read",
      "tickets:manage",
      "markets:read",
      "markets:manage",
      "prospects:read",
      "prospects:manage",
      "agents:read",
      "agents:manage",
      "teams:read",
      "leaderboard:read",
      "subscriber_snapshots:read",
      "business_events:read",
      "vouchers:read",
      "vouchers:manage",
      "vouchers:redeem",
      "commissions:read",
      "plans:read",
      "usage:read",
      "financials:read",
      "analytics:read",
      "risk_center:read",
      "reports:read",
      "compliance:access",
    ],
    syncToWorkos: true,
  },
  {
    key: "investor_viewer",
    name: "Investor View",
    slug: "investor_viewer",
    description: "Read-only financial reporting for investors.",
    isSystem: true,
    isPlatform: true,
    rank: 210,
    permissions: [
      "dashboard:access",
      "business_events:read",
      "revenue:view",
      "financials:read",
      "analytics:read",
      "subscriber_snapshots:read",
      "reports:read",
      "investors:read",
      "compliance:access",
    ],
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
  member: "member",
  ops_manager: "ops_manager",
  finance_manager: "finance_manager",
  market_manager: "market_manager",
  support: "platform_support",
  investor_viewer: "investor_viewer",
  agent: "agent",
  operator: "network_operator",
};

/** Residual platformRole mirror values that map onto system roles. */
export const PLATFORM_ROLE_TO_SYSTEM_SLUG: Record<string, string> = {
  platform_owner: "platform_owner",
  platform_admin: "platform_admin",
  platform_support: "platform_support",
  member: "member",
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