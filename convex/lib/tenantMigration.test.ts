import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BACKFILL_BATCH_SIZE,
  MARKET_DERIVED_BACKFILL_TABLES,
  MARKET_SITE_RESCOPING,
  MAX_BACKFILL_AGENT_PAGE,
  MAX_BACKFILL_BATCH_SIZE,
  MAX_BACKFILL_CHILD_ROWS,
  PLATFORM_OWNED_TABLES,
  TENANT_BACKFILL_RUN_ID,
  TENANT_BACKFILL_TABLE_ORDER,
  TENANT_FEATURE_FLAGS,
  TENANT_OWNED_TABLES,
  clampBatchSize,
  isInventoryConsistent,
  isMarketScopedTable,
  singleTenantFromMarketTenants,
  stageRequiresFlag,
  tenantMigrationPlan,
} from "./tenantMigration.ts";

test("the tenant inventory lists retained tenant-owned billing and workspace tables", () => {
  // Spot-check the retained product surface after legacy-monitoring retirement.
  for (const table of [
    "markets",
    "agents",
    "vouchers",
    "expenses",
    "payouts",
    "plans",
    "teams",
    "teamMembers",
    "supportTickets",
    "auditLog",
  ]) {
    assert.ok(TENANT_OWNED_TABLES.includes(table), `expected ${table} in tenant-owned inventory`);
  }
  for (const retired of ["routers", "routerCredentials", "devices"]) {
    assert.ok(!TENANT_OWNED_TABLES.includes(retired), `${retired} must remain retired`);
  }
});

test("platform/global tables are deliberately absent from the tenant inventory", () => {
  for (const table of PLATFORM_OWNED_TABLES) {
    assert.ok(!TENANT_OWNED_TABLES.includes(table), `${table} must stay platform/global`);
  }
});

test("no table is listed as both tenant-owned and platform-owned", () => {
  const both = TENANT_OWNED_TABLES.filter((t) => PLATFORM_OWNED_TABLES.includes(t));
  assert.equal(both.length, 0);
});

test("tenantMigrationPlan follows the add/read/write/backfill/enforce order", () => {
  const plan = tenantMigrationPlan();
  assert.equal(plan[0].stage, "schema");
  const stages = plan.map((s) => s.stage);
  const firstSchema = stages.indexOf("schema");
  const firstRead = stages.indexOf("readPath");
  const firstWrite = stages.indexOf("writePath");
  const firstBackfill = stages.indexOf("backfill");
  const firstEnforce = stages.indexOf("enforcement");
  assert.ok(firstRead > firstSchema);
  assert.ok(firstWrite > firstRead);
  assert.ok(firstBackfill > firstWrite);
  assert.ok(firstEnforce > firstBackfill);
});

test("backfill/enforcement stages are feature-flagged; schema is not", () => {
  assert.equal(stageRequiresFlag("schema"), null);
  assert.equal(stageRequiresFlag("readPath"), TENANT_FEATURE_FLAGS.readPath);
  assert.equal(stageRequiresFlag("writePath"), TENANT_FEATURE_FLAGS.writePath);
  assert.equal(stageRequiresFlag("backfill"), TENANT_FEATURE_FLAGS.backfill);
  assert.equal(stageRequiresFlag("enforcement"), TENANT_FEATURE_FLAGS.enforceRequired);
});

test("isInventoryConsistent accepts the canonical inventory and rejects drift", () => {
  assert.equal(isInventoryConsistent(), true);
  assert.equal(isInventoryConsistent([...TENANT_OWNED_TABLES, "users"]), false);
  assert.equal(isInventoryConsistent(TENANT_OWNED_TABLES.slice(1)), false);
});

test("run id and batch size are stable", () => {
  assert.equal(TENANT_BACKFILL_RUN_ID, "tenantid-backfill-001");
  assert.ok(DEFAULT_BACKFILL_BATCH_SIZE > 0 && DEFAULT_BACKFILL_BATCH_SIZE <= 500);
});

test("clampBatchSize keeps every positive input a usable page size", () => {
  assert.equal(clampBatchSize(undefined), DEFAULT_BACKFILL_BATCH_SIZE);
  assert.equal(clampBatchSize(0), DEFAULT_BACKFILL_BATCH_SIZE);
  assert.equal(clampBatchSize(-5), DEFAULT_BACKFILL_BATCH_SIZE);
  assert.equal(clampBatchSize(Number.NaN), DEFAULT_BACKFILL_BATCH_SIZE);
  assert.equal(clampBatchSize(0.5), 1, "a positive fraction must not clamp to a zero page");
  assert.equal(clampBatchSize(1), 1);
  assert.equal(clampBatchSize(250.9), 250);
  assert.equal(clampBatchSize(MAX_BACKFILL_BATCH_SIZE + 1), MAX_BACKFILL_BATCH_SIZE);
});

test("the agent page cap stays inside the per-transaction read budget", () => {
  // Worst case per agent: capped assignments + activity, each with a market
  // lookup; the whole page must stay under Convex's 32k-document read limit.
  const maxReadsPerAgent = MAX_BACKFILL_CHILD_ROWS * 2 * 2;
  assert.ok(
    MAX_BACKFILL_AGENT_PAGE * maxReadsPerAgent < 32_000,
    `${MAX_BACKFILL_AGENT_PAGE} agents exceed the read budget`,
  );
});

test("market→site rescoping: phase is carry-along and every market-scoped table is tenant-owned", () => {
  assert.equal(MARKET_SITE_RESCOPING.phase, "carry-along");
  assert.equal(MARKET_SITE_RESCOPING.requiresFlag, TENANT_FEATURE_FLAGS.readPath);
  assert.ok(MARKET_SITE_RESCOPING.marketScopedTables.length >= 13);
  for (const table of MARKET_SITE_RESCOPING.marketScopedTables) {
    assert.ok(TENANT_OWNED_TABLES.includes(table), `${table} must be tenant-owned`);
    assert.ok(!PLATFORM_OWNED_TABLES.includes(table), `${table} must not be platform-owned`);
  }
  assert.ok(MARKET_SITE_RESCOPING.marketScopedFiles.length >= 20);
  for (const file of MARKET_SITE_RESCOPING.alreadyGatedFiles) {
    assert.ok(
      MARKET_SITE_RESCOPING.marketScopedFiles.includes(file),
      `${file} must be in the market-scoped file surface`,
    );
  }
});

test("isMarketScopedTable classifies the site-seam tables", () => {
  assert.equal(isMarketScopedTable("expenses"), true);
  assert.equal(isMarketScopedTable("agentMarketAssignments"), true);
  assert.equal(isMarketScopedTable("markets"), false, "markets key the seam, not carry marketId");
  assert.equal(isMarketScopedTable("users"), false);
});

test("singleTenantFromMarketTenants assigns only a deterministically known owner", () => {
  assert.equal(singleTenantFromMarketTenants(["ten_a"]), "ten_a");
  assert.equal(singleTenantFromMarketTenants(["ten_a", "ten_a"]), "ten_a");
  assert.equal(singleTenantFromMarketTenants(["ten_a", null, undefined]), "ten_a");
  assert.equal(singleTenantFromMarketTenants([]), undefined, "unknown owner stays unassigned");
  assert.equal(
    singleTenantFromMarketTenants(["ten_a", "ten_b"]),
    undefined,
    "ambiguous owner spans multiple tenants and stays unassigned",
  );
  assert.equal(singleTenantFromMarketTenants([null, undefined]), undefined);
});

test("backfill walks market-derived tables before agents and only tenant-owned tables", () => {
  for (const table of TENANT_BACKFILL_TABLE_ORDER) {
    assert.ok(TENANT_OWNED_TABLES.includes(table), `${table} must be tenant-owned`);
  }
  for (const table of MARKET_DERIVED_BACKFILL_TABLES) {
    assert.ok(TENANT_BACKFILL_TABLE_ORDER.includes(table), `${table} must be in the backfill order`);
  }
  assert.equal(
    TENANT_BACKFILL_TABLE_ORDER[TENANT_BACKFILL_TABLE_ORDER.length - 1],
    "agents",
    "agents is derived last, after its assignments and activity are assigned",
  );
});
