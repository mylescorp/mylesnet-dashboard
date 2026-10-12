import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, internalMutation, internalQuery } from "./_generated/server";
import { BOOTSTRAP_TENANT_SLUG } from "./lib/tenant.ts";
import { selectBootstrapOwner } from "./lib/tenantCore.ts";
import { requirePlatformSubRoleForUser } from "./lib/auth.ts";
import { logAudit } from "./lib/auditLog.ts";
import {
  MAX_BACKFILL_AGENT_PAGE,
  MAX_BACKFILL_CHILD_ROWS,
  TENANT_BACKFILL_RUN_ID,
  TENANT_BACKFILL_TABLE_ORDER,
  TENANT_FEATURE_FLAGS,
  TenantBackfillTable,
  clampBatchSize,
  singleTenantFromMarketTenants,
} from "./lib/tenantMigration.ts";

/**
 * Phase 1 tenantId backfill runner.
 *
 * Gated by design (§B2): the bounded backfill only runs once the 8-item review
 * queue is resolved, the production deploy from `apps/web` is confirmed, and the
 * `tenant.backfill` feature flag (`system_settings` key) is on. Until then this
 * mutation reports `status: "gated"` and is NOT wired into crons.
 *
 * Ownership is derived, never guessed: a legacy row is assigned only when its
 * owner is deterministically knowable (its market's tenant, or for an agent the
 * single tenant across its market assignments/activity). Rows whose owner
 * cannot be determined stay unassigned and are counted as ambiguous, per Master
 * §B2 ("No record is silently assigned when its owner cannot be determined").
 *
 * The run is idempotent (reuses `runId = tenantid-backfill-001`), bounded
 * (one batch per invocation), resumable (cursor + table index in the run
 * manifest), and tracked in a `migrationRuns` row. Because it reads and changes
 * records across every tenant, it requires an explicit platform sub-role actor:
 * the supplied `actorUserId` must hold platform_super_admin, and every ownership
 * change is written to the sealed audit chain with that actor.
 *
 * Run manually, one batch per invocation, until it reports `done: true`, passing
 * the acting platform operator:
 *   npx convex run tenantMigrations:runTenantIdBackfill \
 *     --args '{"actorUserId":"<users._id>"}'
 */
export const runTenantIdBackfill = internalMutation({
  args: { batchSize: v.optional(v.number()), actorUserId: v.id("users") },
  handler: async (ctx, args) => {
    // Explicit platform sub-role gate before reading the run or changing any
    // ownership. Internal mutations are server-only, so the actor is supplied by
    // the trusted caller and proven here.
    const actor = await requirePlatformSubRoleForUser(ctx, args.actorUserId, [
      "platform_super_admin",
    ]);
    const runId = TENANT_BACKFILL_RUN_ID;
    const tables: readonly TenantBackfillTable[] = TENANT_BACKFILL_TABLE_ORDER;
    const batchSize = clampBatchSize(args.batchSize);

    const existing = await ctx.db
      .query("migrationRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", runId))
      .first();

    if (!(await backfillEnabled(ctx))) {
      return {
        status: "gated" as const,
        done: false,
        runId,
        flag: TENANT_FEATURE_FLAGS.backfill,
        rowsProcessed: existing?.rowsProcessed ?? 0,
      };
    }

    if (existing?.status === "completed") {
      return {
        status: "completed" as const,
        done: true,
        runId,
        rowsProcessed: existing.rowsProcessed,
        manifest: existing.manifest,
      };
    }

    const now = Date.now();
    let runDocId: Id<"migrationRuns">;
    if (existing) {
      runDocId = existing._id;
    } else {
      runDocId = await ctx.db.insert("migrationRuns", {
        runId,
        name: "tenant-id-backfill",
        tables: [...tables],
        status: "running" as const,
        rowsProcessed: 0,
        manifest: emptyManifest(),
        requiredFlags: [TENANT_FEATURE_FLAGS.backfill],
        failedAssertions: [],
        startedBy: actor._id,
        startedAt: now,
        createdAt: now,
      });
      await auditBackfillRun(ctx, actor._id, runDocId, {
        status: "running",
        tableIndex: 0,
        rowsProcessed: 0,
      });
    }

    const manifest = normalizeManifest(existing?.manifest);
    while (manifest.tableIndex < tables.length && manifest.done[tables[manifest.tableIndex]]) {
      manifest.tableIndex += 1;
      manifest.tableCursor = null;
    }

    if (manifest.tableIndex >= tables.length) {
      const rowsProcessed = existing?.rowsProcessed ?? 0;
      await ctx.db.patch(runDocId, {
        status: "completed" as const,
        cursor: undefined,
        rowsProcessed,
        manifest,
        completedAt: Date.now(),
      });
      await auditBackfillRun(ctx, actor._id, runDocId, {
        status: "completed",
        tableIndex: manifest.tableIndex,
        rowsProcessed,
      });
      return { status: "completed" as const, done: true, runId, rowsProcessed, manifest };
    }

    const table = tables[manifest.tableIndex];
    const result = await processBackfillTable(ctx, table, manifest.tableCursor, batchSize, actor._id);

    if (result.blocked) {
      // A precondition for this table is missing (e.g. the bootstrap tenant has
      // not been created yet). Do not advance the manifest so the same run
      // resumes the table once the precondition exists.
      await ctx.db.patch(runDocId, {
        status: "running" as const,
        cursor: manifest.tableCursor ?? undefined,
        rowsProcessed: existing?.rowsProcessed ?? 0,
        manifest,
        startedBy: existing?.startedBy ?? actor._id,
      });
      await auditBackfillRun(ctx, actor._id, runDocId, {
        status: "running",
        table,
        tableIndex: manifest.tableIndex,
        rowsProcessed: existing?.rowsProcessed ?? 0,
      });
      return {
        status: "blocked" as const,
        done: false,
        runId,
        table,
        reason: "bootstrap tenant required before this table can be assigned",
        rowsProcessed: existing?.rowsProcessed ?? 0,
      };
    }

    manifest.counts[table] = (manifest.counts[table] ?? 0) + result.patched;
    manifest.ambiguous[table] = (manifest.ambiguous[table] ?? 0) + result.ambiguous;
    if (result.isDone) {
      manifest.done[table] = true;
      manifest.tableIndex += 1;
      manifest.tableCursor = null;
    } else {
      manifest.tableCursor = result.continueCursor;
    }

    const rowsProcessed = (existing?.rowsProcessed ?? 0) + result.patched;
    const allDone = manifest.tableIndex >= tables.length;
    await ctx.db.patch(runDocId, {
      status: allDone ? ("completed" as const) : ("running" as const),
      cursor: allDone ? undefined : (manifest.tableCursor ?? undefined),
      rowsProcessed,
      manifest,
      startedBy: existing?.startedBy ?? actor._id,
      ...(allDone ? { completedAt: Date.now() } : {}),
    });
    await auditBackfillRun(ctx, actor._id, runDocId, {
      status: allDone ? "completed" : "running",
      table,
      tableIndex: manifest.tableIndex,
      rowsProcessed,
    });

    return {
      status: allDone ? ("completed" as const) : ("running" as const),
      done: allDone,
      runId,
      table,
      scannedThisBatch: result.scanned,
      patchedThisBatch: result.patched,
      ambiguousThisBatch: result.ambiguous,
      rowsProcessed,
      manifest,
    };
  },
});

/** Shape of the backfill manifest persisted on the `migrationRuns` row. */
interface BackfillManifest {
  tableIndex: number;
  tableCursor: string | null;
  counts: Record<string, number>;
  ambiguous: Record<string, number>;
  done: Record<string, boolean>;
}

function emptyManifest(): BackfillManifest {
  return { tableIndex: 0, tableCursor: null, counts: {}, ambiguous: {}, done: {} };
}

function normalizeManifest(raw: unknown): BackfillManifest {
  const value = (raw ?? {}) as Partial<BackfillManifest>;
  const tableIndex = Number.isInteger(value.tableIndex) ? (value.tableIndex as number) : 0;
  return {
    tableIndex: tableIndex >= 0 ? tableIndex : 0,
    tableCursor: typeof value.tableCursor === "string" ? value.tableCursor : null,
    counts: { ...(value.counts ?? {}) },
    ambiguous: { ...(value.ambiguous ?? {}) },
    done: { ...(value.done ?? {}) },
  };
}

/** The `tenant.backfill` flag is a `system_settings` boolean, off unless explicitly enabled. */
async function backfillEnabled(ctx: MutationCtx): Promise<boolean> {
  const row = await ctx.db
    .query("system_settings")
    .withIndex("by_key", (q) => q.eq("key", TENANT_FEATURE_FLAGS.backfill))
    .first();
  if (!row) return false;
  try {
    return JSON.parse(row.valueJson) === true;
  } catch {
    return false;
  }
}

interface BackfillPageResult {
  scanned: number;
  patched: number;
  ambiguous: number;
  isDone: boolean;
  continueCursor: string;
  /** True when a required precondition for the table is missing (no progress). */
  blocked?: boolean;
}

/** Resolver that caches market -> tenant lookups within one batch. */
function marketTenantResolver(ctx: MutationCtx) {
  const cache = new Map<string, Id<"tenants"> | null>();
  return async (marketId: Id<"markets">): Promise<Id<"tenants"> | null> => {
    const key = marketId as string;
    const cached = cache.get(key);
    if (cached !== undefined) return cached;
    const market = await ctx.db.get(marketId);
    const tenantId = market?.tenantId ?? null;
    cache.set(key, tenantId);
    return tenantId;
  };
}

/**
 * Process one bounded page for the given table, patching rows whose owner is
 * deterministically derivable and leaving the rest untouched. Every ownership
 * change is written to the sealed audit chain with the acting platform actor.
 */
async function processBackfillTable(
  ctx: MutationCtx,
  table: TenantBackfillTable,
  cursor: string | null,
  batchSize: number,
  actorUserId: Id<"users">,
): Promise<BackfillPageResult> {
  const resolveMarketTenant = marketTenantResolver(ctx);

  switch (table) {
    case "markets": {
      const bootstrap = await ctx.db
        .query("tenants")
        .withIndex("by_slug", (q) => q.eq("slug", BOOTSTRAP_TENANT_SLUG))
        .first();
      if (!bootstrap) {
        // The bootstrap tenant is a hard precondition for the market batch.
        // Without it every unassigned market would be skipped and the table
        // marked done, so an early run could never repair those rows later.
        // Block instead of advancing so the same run resumes once it exists.
        return {
          scanned: 0,
          patched: 0,
          ambiguous: 0,
          isDone: false,
          continueCursor: cursor ?? "",
          blocked: true,
        };
      }
      const page = await ctx.db
        .query("markets")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      let patched = 0;
      let ambiguous = 0;
      for (const market of page.page) {
        if (market.tenantId !== undefined) continue;
        await ctx.db.patch(market._id, { tenantId: bootstrap._id });
        await auditBackfillAssignment(ctx, actorUserId, "markets", market._id, bootstrap._id);
        patched += 1;
      }
      return { scanned: page.page.length, patched, ambiguous, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "agentMarketAssignments": {
      const page = await ctx.db
        .query("agentMarketAssignments")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      const counts = await processMarketDerivedRows(
        ctx,
        page.page,
        "agentMarketAssignments",
        resolveMarketTenant,
        actorUserId,
      );
      return { scanned: page.page.length, ...counts, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "agentActivity": {
      const page = await ctx.db
        .query("agentActivity")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      const counts = await processMarketDerivedRows(
        ctx,
        page.page,
        "agentActivity",
        resolveMarketTenant,
        actorUserId,
      );
      return { scanned: page.page.length, ...counts, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "subscriberSnapshots": {
      const page = await ctx.db
        .query("subscriberSnapshots")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      const counts = await processMarketDerivedRows(
        ctx,
        page.page,
        "subscriberSnapshots",
        resolveMarketTenant,
        actorUserId,
      );
      return { scanned: page.page.length, ...counts, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "dailySnapshots": {
      const page = await ctx.db
        .query("dailySnapshots")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      const counts = await processMarketDerivedRows(
        ctx,
        page.page,
        "dailySnapshots",
        resolveMarketTenant,
        actorUserId,
      );
      return { scanned: page.page.length, ...counts, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "marketFinancials": {
      const page = await ctx.db
        .query("marketFinancials")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      const counts = await processMarketDerivedRows(
        ctx,
        page.page,
        "marketFinancials",
        resolveMarketTenant,
        actorUserId,
      );
      return { scanned: page.page.length, ...counts, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "expenses": {
      const page = await ctx.db
        .query("expenses")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      const counts = await processMarketDerivedRows(
        ctx,
        page.page,
        "expenses",
        resolveMarketTenant,
        actorUserId,
      );
      return { scanned: page.page.length, ...counts, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "agents": {
      // Resolving one agent reads up to `MAX_BACKFILL_CHILD_ROWS` assignments
      // plus the same again in activity (each with a market lookup), so the page
      // is capped well below the operator batch to keep the whole invocation
      // inside Convex's per-transaction read limit.
      const agentPageSize = Math.max(1, Math.min(batchSize, MAX_BACKFILL_AGENT_PAGE));
      const page = await ctx.db
        .query("agents")
        .order("asc")
        .paginate({ numItems: agentPageSize, cursor });
      let patched = 0;
      let ambiguous = 0;
      for (const agent of page.page) {
        if (agent.tenantId !== undefined) continue;
        const derived = await resolveAgentTenant(ctx, agent._id, resolveMarketTenant);
        if (derived) {
          await ctx.db.patch(agent._id, { tenantId: derived });
          await auditBackfillAssignment(ctx, actorUserId, "agents", agent._id, derived);
          patched += 1;
        } else {
          ambiguous += 1;
        }
      }
      return { scanned: page.page.length, patched, ambiguous, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    default: {
      return { scanned: 0, patched: 0, ambiguous: 0, isDone: true, continueCursor: "" };
    }
  }
}

/**
 * Audit one backfill ownership assignment on the sealed chain. The actor and
 * the affected record are always recorded; the payload holds only the routing
 * facts (table, row, assigned tenant), never row contents.
 */
async function auditBackfillAssignment(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  table: string,
  rowId: string,
  tenantId: Id<"tenants">,
): Promise<void> {
  await logAudit(ctx, {
    action: "tenant.backfill.assign",
    entityTable: table,
    entityId: rowId,
    changedBy: actorUserId,
    tenantId,
    after: { assignedTenantId: tenantId },
  });
}

/**
 * Audit one change to the backfill run record. Every invocation that writes the
 * run — start, advance, block, or completion — records the actor, the run, and
 * only the routing facts (status, table, cursor progress, rows processed).
 */
async function auditBackfillRun(
  ctx: MutationCtx,
  actorUserId: Id<"users">,
  runId: Id<"migrationRuns">,
  after: { status: string; table?: string; tableIndex: number; rowsProcessed: number },
): Promise<void> {
  await logAudit(ctx, {
    action: "tenant.backfill.run",
    entityTable: "migrationRuns",
    entityId: runId,
    changedBy: actorUserId,
    tenantId: null,
    after,
  });
}

/**
 * Assign one page of market-derived legacy rows from their market's tenant and
 * audit each ownership change. Rows without a market, or whose market has no
 * tenant yet, stay unassigned and are counted as ambiguous.
 */
async function processMarketDerivedRows(
  ctx: MutationCtx,
  rows: ReadonlyArray<{
    _id: string;
    tenantId?: Id<"tenants"> | null;
    marketId?: Id<"markets"> | null;
  }>,
  table: string,
  resolveMarketTenant: (marketId: Id<"markets">) => Promise<Id<"tenants"> | null>,
  actorUserId: Id<"users">,
): Promise<{ patched: number; ambiguous: number }> {
  let patched = 0;
  let ambiguous = 0;
  for (const row of rows) {
    if (row.tenantId !== undefined) continue;
    if (row.marketId === undefined || row.marketId === null) {
      ambiguous += 1;
      continue;
    }
    const tenantId = await resolveMarketTenant(row.marketId);
    if (tenantId) {
      await ctx.db.patch(row._id as never, { tenantId });
      await auditBackfillAssignment(ctx, actorUserId, table, row._id, tenantId);
      patched += 1;
    } else {
      ambiguous += 1;
    }
  }
  return { patched, ambiguous };
}

/**
 * Resolve the single owning tenant for a legacy agent, or null when it cannot
 * be determined.
 *
 * Ownership evidence is read in bounded pages because agent history is
 * unbounded: a bounded batch must never fail (and lose its cursor) on one
 * oversized history, so an agent whose assignments or activity exceed the cap
 * stays unassigned rather than failing the batch or guessing an owner.
 *
 * Market assignments give the strongest evidence: one distinct tenant wins;
 * conflicting tenants leave the agent unassigned; and the activity fallback is
 * used ONLY when the assignments provide no ownership evidence at all (no
 * assignments, or none resolve to a tenant yet).
 */
async function resolveAgentTenant(
  ctx: MutationCtx,
  agentId: Id<"agents">,
  resolveMarketTenant: (marketId: Id<"markets">) => Promise<Id<"tenants"> | null>,
): Promise<Id<"tenants"> | null> {
  const assignments = await ctx.db
    .query("agentMarketAssignments")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("asc")
    .take(MAX_BACKFILL_CHILD_ROWS + 1);
  if (assignments.length > MAX_BACKFILL_CHILD_ROWS) return null;

  const assignmentTenants: Array<string | undefined> = [];
  for (const assignment of assignments) {
    const tenantId = await resolveMarketTenant(assignment.marketId);
    assignmentTenants.push(tenantId ?? undefined);
  }
  const derived = singleTenantFromMarketTenants(assignmentTenants);
  if (derived) return derived as Id<"tenants">;

  // Conflict: assignments span more than one tenant. Keep the agent
  // unassigned instead of letting single-tenant activity choose an owner.
  const hasAssignmentEvidence = assignmentTenants.some((tenantId) => tenantId !== undefined);
  if (hasAssignmentEvidence) return null;

  // No ownership evidence from assignments: fall back to the agent's own
  // activity markets, bounded the same way.
  const activity = await ctx.db
    .query("agentActivity")
    .withIndex("by_agent", (q) => q.eq("agentId", agentId))
    .order("asc")
    .take(MAX_BACKFILL_CHILD_ROWS + 1);
  if (activity.length > MAX_BACKFILL_CHILD_ROWS) return null;

  const activityTenants: Array<string | undefined> = [];
  for (const entry of activity) {
    const tenantId = await resolveMarketTenant(entry.marketId);
    activityTenants.push(tenantId ?? undefined);
  }
  return (singleTenantFromMarketTenants(activityTenants) as Id<"tenants"> | undefined) ?? null;
}

/**
 * Bootstrap the single-operator tenant (slug "mylesnet") and grant the
 * platform owner an active `tenantMemberships` row so the additive read/write
 * guards can resolve tenancy for the real account. Additive and idempotent:
 * re-running never duplicates the tenant or membership, and it creates no
 * fabricated personas — the owner row already exists as a real user.
 *
 * Not cron-wired; run from the CLI via:
 *   npx convex run tenantMigrations:bootstrapTenant --args '{}'
 *   npx convex run tenantMigrations:bootstrapTenant --args '{"bootstrapUserId":"<users._id>"}'
 */
export const bootstrapTenant = internalMutation({
  args: {
    bootstrapUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const now = Date.now();

    // Confirm a real owner before creating anything. This intentionally makes
    // an empty or ownerless database a hard refusal, not a speculative tenant.
    const allUsers = await ctx.db.query("users").collect();
    const owner = selectBootstrapOwner(allUsers, args.bootstrapUserId);
    if (!owner) {
      throw new Error(
        "bootstrapTenant: no active platform owner user found; pass an active bootstrapUserId",
      );
    }

    const existingTenant = await ctx.db
      .query("tenants")
      .withIndex("by_slug", (q) => q.eq("slug", BOOTSTRAP_TENANT_SLUG))
      .first();
    const tenantId =
      existingTenant?._id ??
      (await ctx.db.insert("tenants", {
        slug: BOOTSTRAP_TENANT_SLUG,
        name: "MylesNet",
        country: "KE",
        timezone: "Africa/Nairobi",
        currency: "KES",
        status: "active",
        createdAt: now,
        updatedAt: now,
      }));

    const existingOwner = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) =>
        q.eq("userId", owner._id).eq("tenantId", tenantId),
      )
      .first();
    if (!existingOwner) {
      await ctx.db.insert("tenantMemberships", {
        userId: owner._id,
        tenantId,
        role: "owner",
        status: "active",
        joinedAt: now,
      });
    }

    return {
      status: "ok",
      tenantId,
      userId: owner._id,
      tenantCreated: existingTenant === undefined,
      membershipCreated: existingOwner === undefined,
    };
  },
});

/**
 * Classify only WorkOS organizations that the server may synchronize.
 * Unknown organization claims are never treated as a platform or tenant.
 */
export const getKnownOrganizationScope = internalQuery({
  args: { organizationId: v.string() },
  handler: async (ctx, args) => {
    if (args.organizationId === process.env.MYLESNET_PLATFORM_ORG_ID) {
      return { kind: "platform" as const };
    }
    if (args.organizationId === process.env.MYLESNET_NETWORK_ORG_ID) {
      return { kind: "network" as const };
    }
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_workosOrganizationId", (q) =>
        q.eq("workosOrganizationId", args.organizationId),
      )
      .first();
    return tenant
      ? { kind: "tenant" as const, tenantId: tenant._id }
      : { kind: "unknown" as const };
  },
});
