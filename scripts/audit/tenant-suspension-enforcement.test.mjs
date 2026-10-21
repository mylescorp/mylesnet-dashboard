import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Tenant suspension enforcement contract.
 *
 * A suspended tenant must be denied at the tenant authorization boundary, not
 * only in the platform panel. Two properties are fixed here:
 *
 *  1. All tenant-scoped reads/writes route through the membership choke point
 *     (`getActiveTenantMembership` -> `canTenantOperate`), so a suspended
 *     tenant's members cannot reach tenant data.
 *  2. Every public `query`/`mutation` in a tenant-facing module carries a role
 *     guard (directly or through a local helper) or resolver-plus-permission
 *     read guard, unless it is on the reviewed allowlist below.
 *
 * Cancellation is deliberately NOT a lifecycle action here: `setStatus` accepts
 * only `active`/`suspended`, so cancellation cannot bypass the retention and
 * offboarding flow that the owner has not yet approved.
 */

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
const convexDir = join(repoRoot, "convex");

/** Guards that enforce the tenant lifecycle (suspension included). */
const ROLE_GUARDS = [
  "requireTenantPermission",
  "requirePermission",
  "requirePlatformUser",
  "requirePlatformAdmin",
  "requirePlatformOwner",
  "requirePlatformSubRole",
  "requirePlatformSubRoleForUser",
  "requireAnyRole",
  "requireOpsOrAbove",
  "requireFinanceOrAbove",
  "requireInvestorViewer",
  "requireNetworkOperator",
];

/**
 * Public handlers that intentionally do not take a role guard. Each is
 * reviewed and justified; the test fails if the list and the code disagree.
 */
const ALLOWED_UNGUARDED = {
  "tenantControl.ts:getCurrentWorkspace":
    "Self-service workspace query for the signed-in member; it resolves tenancy itself and returns a typed `setup_required` (reason `tenant_suspended`) instead of data for a suspended tenant, which is the documented dashboard gate.",
};

/** Resolve local (same-file) helper calls so indirect guards are credited. */
function collectGuardedBodies(src) {
  const localFunctionBodies = new Map();
  const fnPattern = /(?:async\s+)?function\s+(\w+)\s*\(|const\s+(\w+)\s*=\s*(?:async\s*)?\(?[^)]*\)?\s*=>/g;
  let fn;
  while ((fn = fnPattern.exec(src))) {
    const name = fn[1] ?? fn[2];
    if (!name) continue;
    const start = fn.index;
    const nextExport = src.indexOf("\nexport ", start + 1);
    const nextFunction = src.slice(start + 1).search(/(?:^|\n)(?:async\s+)?function\s+\w+\s*\(|(?:^|\n)const\s+\w+\s*=/);
    const localEnd = nextFunction === -1 ? src.length : start + 1 + nextFunction;
    const end = nextExport === -1 ? localEnd : Math.min(nextExport, localEnd);
    localFunctionBodies.set(name, src.slice(start, end));
  }
  return localFunctionBodies;
}

/**
 * A resolver-only read may guard itself by resolving tenancy (which denies a
 * suspended tenant) and then checking the action permission explicitly.
 */
function resolverOnlyGuard(body) {
  return body.includes("resolveTenantAccess(") && body.includes("tenantRoleHasPermission(");
}

/** True when the body (or a local helper it calls) uses a role guard. */
function bodyHasGuard(body, localFunctionBodies, seen = new Set()) {
  if (ROLE_GUARDS.some((guard) => body.includes(`${guard}(`))) return true;
  if (resolverOnlyGuard(body)) return true;
  for (const [name, helperBody] of localFunctionBodies) {
    if (seen.has(name)) continue;
    if (!new RegExp(`\\b${name}\\s*\\(`).test(body)) continue;
    seen.add(name);
    if (bodyHasGuard(helperBody, localFunctionBodies, seen)) return true;
  }
  return false;
}

/** Public `query`/`mutation` handlers declared in a module, with their bodies. */
function publicHandlers(src) {
  const re = /export const (\w+) = (query|mutation)\(/g;
  const handlers = [];
  let match;
  while ((match = re.exec(src))) {
    const end = src.indexOf("\nexport ", match.index + 1);
    handlers.push({ name: match[1], body: src.slice(match.index, end === -1 ? src.length : end) });
  }
  return handlers;
}

async function tenantFacingModules() {
  const files = (await readdir(convexDir)).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  const modules = [];
  for (const file of files) {
    const src = await readFile(join(convexDir, file), "utf8");
    if (src.includes('from "./lib/tenant"') || src.includes("requireTenantPermission(")) {
      modules.push({ file, src });
    }
  }
  return modules.sort((a, b) => a.file.localeCompare(b.file));
}

test("tenant-facing modules are discovered from real tenancy usage", async () => {
  const modules = await tenantFacingModules();
  const files = modules.map((m) => m.file);
  assert.ok(files.length >= 15, `expected the tenant surface, found ${files.length} modules`);
  assert.ok(files.includes("subscribers.ts"), "subscribers.ts uses requireTenantPermission");
  assert.ok(files.includes("vouchers.ts"), "vouchers.ts imports the tenant helpers");
});

test("suspension is enforced at the membership choke point", async () => {
  const src = await readFile(join(convexDir, "lib/auth.ts"), "utf8");

  const membershipStart = src.indexOf("async function getActiveTenantMembership");
  assert.notEqual(membershipStart, -1, "getActiveTenantMembership must exist");
  const membershipEnd = src.indexOf("\nexport ", membershipStart);
  const membershipBody = src.slice(membershipStart, membershipEnd === -1 ? src.length : membershipEnd);

  assert.match(
    membershipBody,
    /!canTenantOperate\(tenant\.status\)/,
    "membership resolution must deny a tenant that cannot operate (suspended/cancelled/provisioning)",
  );
  assert.match(
    membershipBody,
    /assertTenantRelationshipChainActive\(ctx, tenant\._id\)/,
    "membership resolution must reject suspended agency/reseller ancestor chains",
  );

  assert.match(
    src,
    /if \(relationship\.status !== "active"\) throw new Error\("Unauthorized: agency or reseller access is suspended"\)/,
    "a suspended relationship link must deny access",
  );
});

test("permission guards route tenant access through the suspension choke point", async () => {
  const src = await readFile(join(convexDir, "lib/auth.ts"), "utf8");

  const start = src.indexOf("export async function requirePermission");
  assert.notEqual(start, -1, "requirePermission must exist");
  const end = src.indexOf("\nexport ", start + 1);
  const body = src.slice(start, end === -1 ? src.length : end);
  assert.match(body, /getActiveTenantMembership\(ctx, user\)/, "requirePermission must resolve tenant access through the choke point");

  const tenantStart = src.indexOf("export async function requireTenantPermission");
  assert.notEqual(tenantStart, -1, "requireTenantPermission must exist");
  const tenantEnd = src.indexOf("\nexport ", tenantStart + 1);
  const tenantBody = src.slice(tenantStart, tenantEnd === -1 ? src.length : tenantEnd);
  assert.match(tenantBody, /getActiveTenantMembership\(ctx, user\)/, "requireTenantPermission must resolve tenant access through the choke point");
});

test("every tenant-facing public handler is role-guarded or explicitly reviewed", async () => {
  const modules = await tenantFacingModules();
  const problems = [];
  const stillAllowlisted = new Set();

  for (const { file, src } of modules) {
    const localFunctionBodies = collectGuardedBodies(src);
    for (const handler of publicHandlers(src)) {
      if (bodyHasGuard(handler.body, localFunctionBodies)) continue;
      const key = `${file}:${handler.name}`;
      if (ALLOWED_UNGUARDED[key]) {
        stillAllowlisted.add(key);
        continue;
      }
      problems.push(key);
    }
  }

  assert.deepEqual(
    problems,
    [],
    `unguarded tenant-facing handlers (add a role guard or a reviewed ALLOWED_UNGUARDED entry): ${problems.join(", ")}`,
  );

  for (const key of Object.keys(ALLOWED_UNGUARDED)) {
    assert.ok(stillAllowlisted.has(key), `ALLOWED_UNGUARDED entry no longer matches code: ${key}`);
  }
});

test("cancellation cannot be reached through the tenant lifecycle action", async () => {
  const control = await readFile(join(convexDir, "tenantControl.ts"), "utf8");
  const setStatusStart = control.indexOf("export const setStatus = mutation");
  assert.notEqual(setStatusStart, -1, "setStatus must exist");
  const setStatusEnd = control.indexOf("\n});", setStatusStart);
  const setStatusBody = control.slice(setStatusStart, setStatusEnd === -1 ? setStatusStart + 1200 : setStatusEnd);
  assert.match(
    setStatusBody,
    /status:\s*v\.union\(v\.literal\("active"\),\s*v\.literal\("suspended"\)\)/,
    "the lifecycle action must accept only active/suspended; cancellation stays behind an approved retention flow",
  );
  assert.doesNotMatch(setStatusBody, /"cancelled"/, "setStatus must not accept a cancelled status");

  const core = await readFile(join(convexDir, "lib/tenantLifecycleCore.ts"), "utf8");
  assert.match(
    core,
    /requested:\s*"active"\s*\|\s*"suspended"/,
    "the lifecycle transition core must not model cancellation as a requested status",
  );
});
