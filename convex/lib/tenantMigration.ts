/**
 * Phase 1 tenantId migration plan (X-TEN §B2) — pure planning contract for the
 * additive migration. Mirrors the transition-inventory classification
 * (Reports/transition-inventory-2026-09-09) and reuses the Phase 0
 * `migrationRunCore.ts` primitives (bounded batches, assertions, manifest,
 * rollback checkpoints, feature-flag gating).
 *
 * The plan is DESIGN, not execution: the gated backfill (`convex/tenantMigrations.ts`)
 * stays a no-op stub until the 8-item review queue is resolved and the
 * production deploy from `apps/web` is confirmed.
 */

/** Immutable id of the Phase 1 backfill run (retries reuse it → idempotent). */
export const TENANT_BACKFILL_RUN_ID = "tenantid-backfill-001";

/** Bounded batch size for the tenantId backfill. */
export const DEFAULT_BACKFILL_BATCH_SIZE = 100;

/** Feature flags that gate each reversible stage (system_settings keys). */
export const TENANT_FEATURE_FLAGS = {
  /** Backfill may run bounded batches. */
  backfill: "tenant.backfill",
  /** Read-path enforcement (by_tenant indexes + tenant guards) is active. */
  readPath: "tenant.readPath",
  /** Write-path enforcement (new writes require tenantId) is active. */
  writePath: "tenant.writePath",
  /** Enforcement flips tenantId from optional to required. */
  enforceRequired: "tenant.enforceRequired",
} as const;

export type TenantMigrationStage =
  | "schema"
  | "readPath"
  | "writePath"
  | "backfill"
  | "enforcement";

export interface TenantMigrationStep {
  stage: TenantMigrationStage;
  /** Table name for schema/backfill steps; "all" for enforcement steps. */
  table: string;
  /** Feature flag that must be on before this step may take effect. */
  requiresFlag: string | null;
}

/**
 * Every tenant-owned table (per the transition inventory §1). Platform/global
 * tables are deliberately absent. The list is the source of truth for the
 * backfill plan and the isolation test catalogue.
 */
export const TENANT_OWNED_TABLES: readonly string[] = [
  "organizationMemberships",
  "userMarketMemberships",
  "subscriberEvents",
  "paymentEvents",
  "voucherEvents",
  "ticketEvents",
  "webhookDeliveryLog",
  "latestSubscriberState",
  "ticketStatus",
  "markets",
  "marketOperatingCosts",
  "agents",
  "agentMarketAssignments",
  "commissions",
  "vouchers",
  "voucherBatches",
  "auditLog",
  "supportTickets",
  "leaderboardSnapshots",
  "broadcasts",
  "broadcastDeliveryLogs",
  "agentInvitations",
  "marketFinancials",
  "subscriberSnapshots",
  "agentActivity",
  "expenses",
  "payouts",
  "dailySnapshots",
  "plans",
  "notificationPreferences",
  "scheduledReports",
  "reportExports",
  "teams",
  "teamMembers",
];

/**
 * Global/platform-owned tables that are intentionally NOT tenant-scoped.
 * Used by the plan to assert the exemption set stays correct.
 */
export const PLATFORM_OWNED_TABLES: readonly string[] = [
  "users",
  "roles",
  "invitations",
  "exchangeRates",
  "marketProspects",
  "investors",
  "investorReports",
  "standardSiteKit",
  "system_settings",
  "migrationRuns",
];

/**
 * The staged additive plan (schema → read-path indexes → write-path → backfill
 * → enforcement), per the Master §B2 add-first / read-first / write-first
 * enforcement order.
 */
export function tenantMigrationPlan(
  tables: readonly string[] = TENANT_OWNED_TABLES,
): TenantMigrationStep[] {
  const steps: TenantMigrationStep[] = [];
  for (const table of tables) {
    steps.push({ stage: "schema", table, requiresFlag: null });
  }
  steps.push({ stage: "readPath", table: "all", requiresFlag: TENANT_FEATURE_FLAGS.readPath });
  steps.push({ stage: "writePath", table: "all", requiresFlag: TENANT_FEATURE_FLAGS.writePath });
  steps.push({ stage: "backfill", table: "all", requiresFlag: TENANT_FEATURE_FLAGS.backfill });
  steps.push({ stage: "enforcement", table: "all", requiresFlag: TENANT_FEATURE_FLAGS.enforceRequired });
  return steps;
}

/** The feature flag a given stage is gated on, or null when un-gated. */
export function stageRequiresFlag(stage: TenantMigrationStage): string | null {
  switch (stage) {
    case "readPath":
      return TENANT_FEATURE_FLAGS.readPath;
    case "writePath":
      return TENANT_FEATURE_FLAGS.writePath;
    case "backfill":
      return TENANT_FEATURE_FLAGS.backfill;
    case "enforcement":
      return TENANT_FEATURE_FLAGS.enforceRequired;
    default:
      return null;
  }
}

/** True when every table in the inventory is present and exempt tables absent. */
export function isInventoryConsistent(
  tables: readonly string[] = TENANT_OWNED_TABLES,
): boolean {
  const leftover = TENANT_OWNED_TABLES.filter((t) => !tables.includes(t));
  const imported = tables.filter((t) => !TENANT_OWNED_TABLES.includes(t));
  return leftover.length === 0 && imported.length === 0;
}

/**
 * Market → site re-scoping contract (X-TEN §B16).
 *
 * In Phase 1 a market IS one tenant's site: `markets.tenantId` keys the tenant,
 * `marketId` remains the tenant-internal site seam, and `userMarketMemberships`
 * doubles as a tenant-site membership. The dedicated `sites` entity from the
 * Master spec §18.8 (N-tenant, N-site) is deliberately NOT promoted in Phase 1;
 * that is the Phase 8 "promote-sites" step.
 *
 * The two lists are the retained billing/workspace inventory after the
 * 2026-09-16 legacy-monitoring retirement:
 *   marketScopedTables = schema tables that declare `marketId`
 *   marketScopedFiles  = convex handler/route files referencing `marketId`
 */
export const MARKET_SITE_RESCOPING = {
  /** Phase-1 posture: marketId keeps carrying the tenant-internal site seam. */
  phase: "carry-along" as const,
  /** Tables whose reads/writes already key off `marketId` (site seam). */
  marketScopedTables: [
    "userMarketMemberships",
    "marketOperatingCosts",
    "agentMarketAssignments",
    "commissions",
    "vouchers",
    "voucherBatches",
    "leaderboardSnapshots",
    "marketFinancials",
    "subscriberSnapshots",
    "agentActivity",
    "expenses",
    "dailySnapshots",
    "plans",
  ] as const,
  /** Retained Convex surface touching `marketId`. */
  marketScopedFiles: [
    "agentActivity",
    "agentInvitations",
    "agents",
    "analytics",
    "broadcasts",
    "commissions",
    "costAllocation",
    "dailySnapshots",
    "expenses",
    "http",
    "investors",
    "leaderboard",
    "marketProspects",
    "markets",
    "osMigrations",
    "payouts",
    "plans",
    "platform",
    "platformUsers",
    "scheduledReports",
    "schema",
    "subscriberSnapshots",
    "supportTickets",
    "vouchers",
  ] as const,
  /** Files that already gate reads per-market via requireMarketAccess. */
  alreadyGatedFiles: [
    "plans",
    "supportTickets",
    "vouchers",
  ] as const,
  /** Adoption of the by_tenant read path is gated on this flag. */
  requiresFlag: TENANT_FEATURE_FLAGS.readPath,
} as const;

export type MarketSiteRescopingPhase = (typeof MARKET_SITE_RESCOPING)["phase"];

/** True when a table is part of the market (site) seam surface. */
export function isMarketScopedTable(table: string): boolean {
  return (MARKET_SITE_RESCOPING.marketScopedTables as readonly string[]).includes(table);
}
