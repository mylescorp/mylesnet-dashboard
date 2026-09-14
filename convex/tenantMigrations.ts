import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internalMutation, internalQuery } from "./_generated/server";
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
