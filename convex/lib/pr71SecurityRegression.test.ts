import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const auth = source("../lib/auth.ts");
const seed = source("../seed.ts");
const subscribers = source("../subscribers.ts");
const tickets = source("../supportTickets.ts");
const markets = source("../markets.ts");
const teams = source("../teams.ts");
const reports = source("../scheduledReports.ts");
const permissions = source("../lib/permissions.ts");

test("demo financial seed is internal and disabled unless explicitly enabled", () => {
  assert.match(seed, /export const seedDemoData = internalMutation\(/);
  assert.match(seed, /MYLESNET_DEMO_SEED_ENABLED !== "true"/);
});

test("tenant memberships are rejected when any active ancestor relationship is suspended", () => {
  assert.match(auth, /query\("tenantRelationships"\)[\s\S]*?withIndex\("by_child"/);
  assert.match(auth, /relationship\.status !== "active"/);
  assert.match(auth, /visited\.size > 100/);
});

test("subscriber updates cannot set balances and referenced plans must belong to the workspace", () => {
  const update = subscribers.match(/export const update = mutation\(([\s\S]*?)\n\}\);/);
  assert.ok(update);
  assert.doesNotMatch(update[1]!, /walletBalance/);
  assert.match(subscribers, /assertPlanOwnedByTenant\(ctx, updates\.planId, tenantId\)/);
  assert.match(subscribers, /v\.union\(v\.string\(\), v\.null\(\)\)/);
});

test("tenant support tickets and market writes enforce tenant ownership", () => {
  assert.match(tickets, /withIndex\("by_tenant_created"/);
  assert.match(tickets, /scope\.enforced && ticket\?\.tenantId !== scope\.tenantId/);
  assert.match(markets, /updateMarketLifecycleStatus = mutation\([\s\S]*?enforceTenantOnResource\(ctx, await ctx\.db\.get\(args\.marketId\), "market"\)/);
});

test("team reads and writes validate teams and members in the active workspace", () => {
  assert.match(teams, /readTenantList<Doc<"teams">>/);
  assert.match(teams, /enforceTenantOnResource\(ctx, await ctx\.db\.get\(args\.teamId\), "team"\)/);
  assert.match(teams, /member\.tenantId !== team\.tenantId/);
});

test("report generation is authorized and tenant report readers use scoped indexes", () => {
  assert.match(reports, /authorizeReportGeneration = internalQuery\(/);
  assert.match(reports, /requirePermission\(ctx, "reports:generate"\)/);
  assert.match(reports, /readTenantList\(ctx/);
  assert.match(reports, /withIndex\("by_tenant_created"/);
  assert.match(reports, /tenantId: actor\.tenantId/);
});

test("tenant administrators and managers can read their workspace audit trail", () => {
  const excluded = permissions.match(/const TENANT_ADMIN_EXCLUDED_PERMISSIONS = new Set<string>\(([\s\S]*?)\);/);
  assert.ok(excluded);
  assert.doesNotMatch(excluded[1]!, /"audit_log:read"/);
  assert.match(permissions, /"teams:manage", "payments:read", "invoices:read", "expenses:read",\s*"analytics:read", "reports:read", "audit_log:read"/);
});
