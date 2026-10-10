import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import { BOOTSTRAP_TENANT_SLUG } from "./lib/tenant.ts";
import { selectBootstrapOwner } from "./lib/tenantCore.ts";
import {
  TENANT_BACKFILL_RUN_ID,
  tenantMigrationPlan,
} from "./lib/tenantMigration.ts";

/**
 * Phase 1 tenantId backfill runner — STUB.
 *
 * Gated by design (§B2): the real bounded backfill only runs after the 8-item
 * review queue is resolved, the production deploy from `apps/web` is confirmed,
 * and the `tenant.backfill` feature flag is on. Until then this mutation is a
 * no-op that reports the plan surface. It is NOT wired into crons.
 *
 * The real implementation will use `migrationRunCore.ts` (bounded batches,
 * assertion gates, manifest, rollback checkpoints) and register a
 * `migrationRuns` row with `runId = tenantid-backfill-001` so retries are
 * idempotent.
 */
export const runTenantIdBackfill = internalMutation({
  args: {},
  handler: async () => {
    const plan = tenantMigrationPlan();
    return {
      status: "stub",
      runId: TENANT_BACKFILL_RUN_ID,
      reviewQueue: 8,
      backfillGatedOn: "tenant.backfill",
      steps: plan.map((s) => `${s.stage}:${s.table}`),
      executedRows: 0,
    };
  },
});

/**
 * Safely infer legacy agent ownership from all of that agent's market
 * assignments. Ambiguous and unassigned agents are left untouched and counted
 * for manual review. The by_createdAt cursor remains stable while tenantId is
 * patched, unlike paginating the by_tenant index being modified.
 */
export const backfillAgentTenantOwnership = internalMutation({
  args: {
    cursor: v.optional(v.union(v.string(), v.null())),
    migratedCount: v.optional(v.number()),
    unresolvedCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const page = await ctx.db.query("agents").withIndex("by_createdAt").order("asc").paginate({
      numItems: 100,
      cursor: args.cursor ?? null,
    });
    let migratedCount = args.migratedCount ?? 0;
    let unresolvedCount = args.unresolvedCount ?? 0;

    for (const agent of page.page) {
      const assignments = await ctx.db.query("agentMarketAssignments")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();
      if (assignments.length === 0) {
        if (agent.tenantId === undefined) unresolvedCount += 1;
        continue;
      }
      const markets = await Promise.all(assignments.map((assignment) => ctx.db.get(assignment.marketId)));
      const tenantIds = new Set(markets.flatMap((market) => market?.tenantId ? [market.tenantId] : []));
      const tenantId = agent.tenantId ?? (tenantIds.size === 1 ? [...tenantIds][0] : undefined);
      const ownershipIsConsistent = tenantId !== undefined && markets.every((market) => market?.tenantId === tenantId) &&
        assignments.every((assignment) => assignment.tenantId === undefined || assignment.tenantId === tenantId);
      if (!ownershipIsConsistent || !tenantId) {
        unresolvedCount += 1;
        continue;
      }
      let changed = false;
      if (agent.tenantId === undefined) {
        await ctx.db.patch(agent._id, { tenantId });
        changed = true;
      }
      for (const assignment of assignments) {
        if (assignment.tenantId === undefined) {
          await ctx.db.patch(assignment._id, { tenantId });
          changed = true;
        }
      }
      if (changed) migratedCount += 1;
    }

    if (!page.isDone) {
      await ctx.scheduler.runAfter(0, internal.tenantMigrations.backfillAgentTenantOwnership, {
        cursor: page.continueCursor,
        migratedCount,
        unresolvedCount,
      });
      return { complete: false, migratedCount, unresolvedCount };
    }
    return { complete: true, migratedCount, unresolvedCount };
  },
});

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
        subscriberCount: 0,
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
