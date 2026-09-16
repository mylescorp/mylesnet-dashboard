import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_BACKFILL_BATCH_SIZE,
  MARKET_SITE_RESCOPING,
  PLATFORM_OWNED_TABLES,
  TENANT_BACKFILL_RUN_ID,
  TENANT_FEATURE_FLAGS,
  TENANT_OWNED_TABLES,
  isInventoryConsistent,
  isMarketScopedTable,
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
