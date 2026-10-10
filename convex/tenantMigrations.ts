import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { MutationCtx, internalMutation, internalQuery } from "./_generated/server";
import { BOOTSTRAP_TENANT_SLUG } from "./lib/tenant.ts";
import { selectBootstrapOwner } from "./lib/tenantCore.ts";
import {
  DEFAULT_BACKFILL_BATCH_SIZE,
  TENANT_BACKFILL_RUN_ID,
  TENANT_BACKFILL_TABLE_ORDER,
  TENANT_FEATURE_FLAGS,
  TenantBackfillTable,
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
 * manifest), and tracked in a `migrationRuns` row.
 *
 * Run manually, one batch per invocation, until it reports `done: true`:
 *   npx convex run tenantMigrations:runTenantIdBackfill --args '{}'
 */
export const runTenantIdBackfill = internalMutation({
  args: { batchSize: v.optional(v.number()) },
  handler: async (ctx, args) => {
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
        startedAt: now,
        createdAt: now,
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
      return { status: "completed" as const, done: true, runId, rowsProcessed, manifest };
    }

    const table = tables[manifest.tableIndex];
    const result = await processBackfillTable(ctx, table, manifest.tableCursor, batchSize);

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
      ...(allDone ? { completedAt: Date.now() } : {}),
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

function clampBatchSize(size: number | undefined): number {
  if (!Number.isFinite(size) || (size as number) <= 0) return DEFAULT_BACKFILL_BATCH_SIZE;
  return Math.min(500, Math.floor(size as number));
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
 * deterministically derivable and leaving the rest untouched.
 */
async function processBackfillTable(
  ctx: MutationCtx,
  table: TenantBackfillTable,
  cursor: string | null,
  batchSize: number,
): Promise<BackfillPageResult> {
  const resolveMarketTenant = marketTenantResolver(ctx);

  switch (table) {
    case "markets": {
      const bootstrap = await ctx.db
        .query("tenants")
        .withIndex("by_slug", (q) => q.eq("slug", BOOTSTRAP_TENANT_SLUG))
        .first();
      const page = await ctx.db
        .query("markets")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      let patched = 0;
      let ambiguous = 0;
      for (const market of page.page) {
        if (market.tenantId !== undefined) continue;
        if (!bootstrap) {
          ambiguous += 1;
          continue;
        }
        await ctx.db.patch(market._id, { tenantId: bootstrap._id });
        patched += 1;
      }
      return { scanned: page.page.length, patched, ambiguous, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "agentMarketAssignments": {
      const page = await ctx.db
        .query("agentMarketAssignments")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      let patched = 0;
      let ambiguous = 0;
      for (const row of page.page) {
        if (row.tenantId !== undefined) continue;
        const tenantId = await resolveMarketTenant(row.marketId);
        if (tenantId) {
          await ctx.db.patch(row._id, { tenantId });
          patched += 1;
        } else {
          ambiguous += 1;
        }
      }
      return { scanned: page.page.length, patched, ambiguous, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "agentActivity": {
      const page = await ctx.db
        .query("agentActivity")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      let patched = 0;
      let ambiguous = 0;
      for (const row of page.page) {
        if (row.tenantId !== undefined) continue;
        const tenantId = await resolveMarketTenant(row.marketId);
        if (tenantId) {
          await ctx.db.patch(row._id, { tenantId });
          patched += 1;
        } else {
          ambiguous += 1;
        }
      }
      return { scanned: page.page.length, patched, ambiguous, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "subscriberSnapshots": {
      const page = await ctx.db
        .query("subscriberSnapshots")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      let patched = 0;
      let ambiguous = 0;
      for (const row of page.page) {
        if (row.tenantId !== undefined) continue;
        const tenantId = await resolveMarketTenant(row.marketId);
        if (tenantId) {
          await ctx.db.patch(row._id, { tenantId });
          patched += 1;
        } else {
          ambiguous += 1;
        }
      }
      return { scanned: page.page.length, patched, ambiguous, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "dailySnapshots": {
      const page = await ctx.db
        .query("dailySnapshots")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      let patched = 0;
      let ambiguous = 0;
      for (const row of page.page) {
        if (row.tenantId !== undefined) continue;
        const tenantId = await resolveMarketTenant(row.marketId);
        if (tenantId) {
          await ctx.db.patch(row._id, { tenantId });
          patched += 1;
        } else {
          ambiguous += 1;
        }
      }
      return { scanned: page.page.length, patched, ambiguous, isDone: page.isDone, continueCursor: page.continueCursor };
    }
    case "agents": {
      const page = await ctx.db
        .query("agents")
        .order("asc")
        .paginate({ numItems: batchSize, cursor });
      let patched = 0;
      let ambiguous = 0;
      for (const agent of page.page) {
        if (agent.tenantId !== undefined) continue;
        const assignments = await ctx.db
          .query("agentMarketAssignments")
          .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
          .collect();
        const assignmentTenants: Array<string | undefined> = [];
        for (const assignment of assignments) {
          const tenantId = await resolveMarketTenant(assignment.marketId);
          assignmentTenants.push(tenantId ?? undefined);
        }
        let derived = singleTenantFromMarketTenants(assignmentTenants);
        if (!derived) {
          // Fall back to the agent's own activity markets when it has no
          // (or only ambiguous) assignments.
          const activity = await ctx.db
            .query("agentActivity")
            .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
            .collect();
          const activityTenants: Array<string | undefined> = [];
          for (const entry of activity) {
            const tenantId = await resolveMarketTenant(entry.marketId);
            activityTenants.push(tenantId ?? undefined);
          }
          derived = singleTenantFromMarketTenants(activityTenants);
        }
        if (derived) {
          await ctx.db.patch(agent._id, { tenantId: derived as Id<"tenants"> });
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
