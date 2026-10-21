import test from "node:test";
import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Tenant suspension enforcement contract.
 *
 * A suspended tenant must be denied at the tenant authorization boundary, not
 * only in the platform panel. Three properties are fixed here:
 *
 *  1. All tenant-scoped reads/writes route through the membership choke point
 *     (`getActiveTenantMembership` -> `canTenantOperate`), so a suspended
 *     tenant's members cannot reach tenant data.
 *  2. Every public `query`/`mutation` in a tenant-facing module carries a role
 *     guard (directly or through a local helper) or resolver-plus-permission
 *     read guard, unless it is on the reviewed allowlist below.
 *  3. Cancellation is reachable only through the retention sweep, never
 *     directly: `setStatus` accepts only `active`/`suspended`, and
 *     `decideTenantLifecycleTransition` never yields `cancelled`.
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
 * Modules reviewed as tenant-facing in
 * `docs/audits/tenant-suspension-enforcement-audit-2026-10-21.md`. Pinned so a
 * removed guard cannot drop a module out of coverage; dynamic discovery below
 * still picks up new modules.
 */
const TENANT_FACING_MODULE_BASELINE = [
  "agents.ts",
  "analytics.ts",
  "auditLogTenant.ts",
  "commissions.ts",
  "dashboard.ts",
  "expenses.ts",
  "invoices.ts",
  "markets.ts",
  "networkOps.ts",
  "payments.ts",
  "payouts.ts",
  "plans.ts",
  "scheduledReports.ts",
  "subscriberDetail.ts",
  "subscribers.ts",
  "supportTickets.ts",
  "teams.ts",
  "tenantControl.ts",
  "vouchers.ts",
  "workspaceSettings.ts",
];

/**
 * Public handlers that intentionally do not take a role guard. Each is
 * reviewed and justified; the test fails if the list and the code disagree.
 */
const ALLOWED_UNGUARDED = {
  "tenantControl.ts:getCurrentWorkspace":
    "Self-service workspace query for the signed-in member; it resolves tenancy itself and returns a typed `setup_required` (reason `tenant_suspended`) instead of data for a suspended tenant, which is the documented dashboard gate.",
};

/**
 * Replace comments with whitespace, preserving newlines and line structure, so
 * a commented-out guard is not counted as an active guard. String literals are
 * left intact.
 */
function stripComments(src) {
  let out = "";
  let state = "code";
  for (let i = 0; i < src.length; i += 1) {
    const char = src[i];
    const next = src[i + 1];
    if (state === "code") {
      if (char === "/" && next === "/") {
        state = "line";
        out += "  ";
        i += 1;
      } else if (char === "/" && next === "*") {
        state = "block";
        out += "  ";
        i += 1;
      } else {
        if (char === '"') state = "double";
        else if (char === "'") state = "single";
        else if (char === "`") state = "template";
        out += char;
      }
      continue;
    }
    if (state === "line") {
      if (char === "\n") {
        state = "code";
        out += char;
      } else {
        out += " ";
      }
      continue;
    }
    if (state === "block") {
      if (char === "*" && next === "/") {
        state = "code";
        out += "  ";
        i += 1;
      } else {
        out += char === "\n" ? "\n" : " ";
      }
      continue;
    }
    // Inside a string literal: copy verbatim until the closing quote.
    out += char;
    if (char === "\\") {
      out += next ?? "";
      i += 1;
    } else if (
      (state === "double" && char === '"') ||
      (state === "single" && char === "'") ||
      (state === "template" && char === "`")
    ) {
      state = "code";
    }
  }
  return out;
}

/** Index just past the `}` that closes the block starting at `openIndex`. */
function matchBrace(src, openIndex) {
  let depth = 0;
  let state = "code";
  for (let i = openIndex; i < src.length; i += 1) {
    const char = src[i];
    if (state !== "code") {
      if (char === "\\") {
        i += 1;
      } else if (
        (state === "double" && char === '"') ||
        (state === "single" && char === "'") ||
        (state === "template" && char === "`")
      ) {
        state = "code";
      }
      continue;
    }
    if (char === '"') state = "double";
    else if (char === "'") state = "single";
    else if (char === "`") state = "template";
    else if (char === "{") depth += 1;
    else if (char === "}") {
      depth -= 1;
      if (depth === 0) return i + 1;
    }
  }
  return src.length;
}

/**
 * Top-level local function declarations in a comment-stripped module, mapped to
 * their body text. Each body ends at its own closing brace, so a helper cannot
 * borrow a guard from a later handler it happens to sit above.
 */
function localFunctions(src) {
  const map = new Map();
  const re = /^(?:export )?(?:async )?function (\w+)|^const (\w+) = (?:async )?\(/gm;
  for (const match of src.matchAll(re)) {
    const name = match[1] ?? match[2];
    if (!name) continue;
    const open = src.indexOf("{", match.index);
    const end = open === -1 ? src.length : matchBrace(src, open);
    map.set(name, src.slice(match.index, end));
  }
  return map;
}

/** A resolver-only read may guard itself by resolving tenancy (which denies a
 * suspended tenant) and then checking the action permission explicitly. */
function resolverOnlyGuard(body) {
  return body.includes("resolveTenantAccess(") && body.includes("tenantRoleHasPermission(");
}

/**
 * The retention sweep must select only tenants whose deletion window has
 * elapsed and mark them cancelled. Selecting `pending_deletion` alone would let
 * the next sweep cancel a tenant that is still inside its recovery window.
 */
function hasDeletionDeadline(body) {
  return (
    /eq\("status", "pending_deletion"\)/.test(body) &&
    /lte\("scheduledDeletionAt",\s*now\)/.test(body) &&
    /status: "cancelled"/.test(body)
  );
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

/** Public `query`/`mutation` handlers declared in a comment-stripped module. */
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

/** Files a module must exist for; discovery is independent of the audited guards. */
async function tenantFacingModules() {
  const files = (await readdir(convexDir)).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
  const modules = [];
  for (const file of files) {
    const baseOnly = TENANT_FACING_MODULE_BASELINE.includes(file);
    const src = stripComments(await readFile(join(convexDir, file), "utf8"));
    if (baseOnly || src.includes('from "./lib/tenant"') || src.includes("requireTenantPermission(")) {
      modules.push({ file, src });
    }
  }
  return modules.sort((a, b) => a.file.localeCompare(b.file));
}

test("every reviewed tenant-facing module still exists", async () => {
  const files = await readdir(convexDir);
  for (const module of TENANT_FACING_MODULE_BASELINE) {
    assert.ok(files.includes(module), `${module} is in the reviewed tenant-facing baseline but no longer exists`);
  }
});

test("tenant-facing discovery finds the reviewed baseline", async () => {
  const modules = (await tenantFacingModules()).map((m) => m.file);
  for (const module of TENANT_FACING_MODULE_BASELINE) {
    assert.ok(modules.includes(module), `${module} must be covered by the suspension audit`);
  }
  assert.ok(modules.length >= TENANT_FACING_MODULE_BASELINE.length, "discovery must not drop baseline modules");
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

test("helper bodies stop at their own end", () => {
  const src = stripComments(
    [
      "function plainHelper(x) {",
      "  return x;",
      "}",
      "",
      "function guardedHelper(ctx) {",
      '  return requireTenantPermission(ctx, "a:read");',
      "}",
      "",
      "export const viaHelper = query({ handler: async (ctx) => { return guardedHelper(ctx); } });",
      "export const unguarded = query({ handler: async (ctx) => { return plainHelper(1); } });",
    ].join("\n"),
  );
  const helpers = localFunctions(src);
  const handlers = publicHandlers(src);
  const viaHelper = handlers.find((h) => h.name === "viaHelper");
  const unguarded = handlers.find((h) => h.name === "unguarded");

  assert.equal(bodyHasGuard(viaHelper.body, helpers), true, "a helper that calls a guard must satisfy the audit");
  assert.equal(
    bodyHasGuard(unguarded.body, helpers),
    false,
    "a helper must not borrow a guard from a later handler above which it sits",
  );
  assert.doesNotMatch(helpers.get("plainHelper"), /requireTenantPermission/, "a helper body must stop at its own closing brace");
});

test("the retention deadline check is required", () => {
  const withoutDeadline =
    'const due = ctx.db.query("tenants").withIndex("by_status_and_scheduled_deletion", q => q.eq("status", "pending_deletion")).take(100);\n' +
    'for (const tenant of due) { await ctx.db.patch(tenant._id, { status: "cancelled", deletedAt: now }); }';
  const withDeadline = withoutDeadline.replace(
    'q.eq("status", "pending_deletion")',
    'q.eq("status", "pending_deletion").lte("scheduledDeletionAt", now)',
  );

  assert.equal(hasDeletionDeadline(withoutDeadline), false, "a sweep without the scheduledDeletionAt deadline must not satisfy the audit");
  assert.equal(hasDeletionDeadline(withDeadline), true, "a sweep that waits for the deadline must satisfy the audit");
});

test("commented-out guards do not count as guards", () => {
  const commented = stripComments(`
    export const list = query({
      handler: async (ctx) => {
        // await requireTenantPermission(ctx, "plans:read");
        /* requirePermission(ctx, "plans:read"); */
        return [];
      },
    });
  `);
  const handlers = publicHandlers(commented);
  assert.equal(handlers.length, 1);
  assert.equal(bodyHasGuard(handlers[0].body, localFunctions(commented)), false, "a commented-out guard must not satisfy the audit");

  const active = stripComments(`export const list = query({ handler: async (ctx) => { await requireTenantPermission(ctx, "plans:read"); } });`);
  assert.equal(bodyHasGuard(publicHandlers(active)[0].body, localFunctions(active)), true, "an active guard must satisfy the audit");
});

test("every tenant-facing public handler is role-guarded or explicitly reviewed", async () => {
  const modules = await tenantFacingModules();
  const problems = [];
  const stillAllowlisted = new Set();

  for (const { file, src } of modules) {
    const localFunctionBodies = localFunctions(src);
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

test("cancellation is reachable only through the retention sweep", async () => {
  const control = await readFile(join(convexDir, "tenantControl.ts"), "utf8");

  const setStatusStart = control.indexOf("export const setStatus = mutation");
  assert.notEqual(setStatusStart, -1, "setStatus must exist");
  const setStatusEnd = control.indexOf("\n});", setStatusStart);
  const setStatusBody = control.slice(setStatusStart, setStatusEnd === -1 ? setStatusStart + 1200 : setStatusEnd);
  assert.match(
    setStatusBody,
    /status:\s*v\.union\(v\.literal\("active"\),\s*v\.literal\("suspended"\)\)/,
    "the lifecycle action must accept only active/suspended",
  );
  assert.doesNotMatch(setStatusBody, /"cancelled"/, "setStatus must not accept a cancelled status");

  const finalizeStart = control.indexOf("export const finalizeExpiredDeletions = internalMutation");
  assert.notEqual(finalizeStart, -1, "finalizeExpiredDeletions must exist");
  const finalizeEnd = control.indexOf("\n});", finalizeStart);
  const finalizeBody = control.slice(finalizeStart, finalizeEnd === -1 ? control.length : finalizeEnd);
  assert.ok(
    hasDeletionDeadline(finalizeBody),
    "the retention sweep must select pending_deletion rows past scheduledDeletionAt and mark them cancelled",
  );

  const core = await readFile(join(convexDir, "lib/tenantLifecycleCore.ts"), "utf8");
  assert.match(
    core,
    /requested:\s*"active"\s*\|\s*"suspended"/,
    "the lifecycle transition core must not model cancellation as a requested status",
  );

  const crons = await readFile(join(convexDir, "crons.ts"), "utf8");
  assert.match(crons, /finalizeExpiredDeletions/, "the retention sweep must stay scheduled");
});
