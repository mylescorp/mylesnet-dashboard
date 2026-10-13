/**
 * Canonical platform module access matrix.
 *
 * Each list holds the spec sub-roles the module register grants, exactly as the
 * register names them. Every Convex platform gate and the panel UI resolve them
 * through `PLATFORM_SUB_ROLE_MAP`, so a role the matrix does not name is denied
 * rather than implicitly allowed.
 *
 * This file is the single source of truth: the server gates import these lists,
 * and the server/UI parity guard (`apps/web/platform/permissions.test.ts`)
 * asserts the panel visibility helpers agree. Changing access means changing it
 * here once.
 */

/** Read the platform control plane: tenant records, catalogs, cross-tenant lists. */
export const PLATFORM_READ_SUB_ROLES: string[] = [
  "platform_super_admin",
  "platform_ops",
  "platform_finance",
  "platform_support",
  "platform_readonly",
];

/** Operate platform resources: tenants, provisioning, markets, flags, redemption. */
export const PLATFORM_OPERATE_SUB_ROLES: string[] = ["platform_super_admin", "platform_ops"];

/** Manage revenue plans, scheduled reports, and finance-facing settings. */
export const PLATFORM_FINANCE_SUB_ROLES: string[] = ["platform_super_admin", "platform_finance"];

/** Read revenue rollups and reconciliation figures. */
export const PLATFORM_REVENUE_READ_SUB_ROLES: string[] = [
  "platform_super_admin",
  "platform_finance",
  "platform_readonly",
];

/** Monitor voucher redemption risk signals. */
export const PLATFORM_VOUCHER_MONITOR_SUB_ROLES: string[] = [
  "platform_super_admin",
  "platform_ops",
  "platform_finance",
];

/** Read the device fleet registry and provisioning queue. */
export const PLATFORM_FLEET_READ_SUB_ROLES: string[] = [
  "platform_super_admin",
  "platform_ops",
  "platform_support",
  "platform_readonly",
];

/** Read unscoped cross-tenant analytics rows (module register J1). */
export const PLATFORM_ANALYTICS_READ_SUB_ROLES: string[] = [
  "platform_super_admin",
  "platform_finance",
  "platform_ops",
  "platform_readonly",
];

/** Irreversible or identity-level actions: cancellation, ownership migration. */
export const PLATFORM_SUPER_ADMIN_SUB_ROLES: string[] = ["platform_super_admin"];
