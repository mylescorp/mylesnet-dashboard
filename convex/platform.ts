import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { listAuditLog as readAuditLog } from "./lib/auditLog";
import { AUDIT_CHAIN_VERIFY_RUN_ID } from "./auditChainVerify";
import {
  isPlatformUser,
  permissionsOf,
  requirePlatformUser,
  resolveRoles,
  resolveUserByIdentity,
} from "./lib/auth";

/**
 * Returns the current authenticated platform user's role, permissions and
 * profile, or null if they are not signed in at all. Used by the layout guard
 * to decide whether to show the panel, bounce to /signin, or show /unauthorized.
 */
export const getCurrentPlatformUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) return null;

    const roles = await resolveRoles(ctx, user);
    const primary = roles.slice().sort((left, right) => right.rank - left.rank)[0] ?? null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      // A remote image is only rendered by the client when this Convex
      // storage reference is present. WorkOS profile image URLs are treated
      // as untrusted display data and fall back to initials instead.
      avatarStorageId: user.avatarStorageId ?? null,
      jobTitle: user.jobTitle,
      platformRole: user.platformRole ?? null,
      isPlatform: isPlatformUser(roles),
      canViewRevenue: roles.some((role) => role.permissions.includes("revenue:view")),
      mfaEnrolled: user.mfaEnrolled === true,
      permissions: permissionsOf(roles),
      roles: roles.map((role) => ({
        _id: role._id,
        slug: role.slug,
        name: role.name,
        isPlatform: role.isPlatform,
        rank: role.rank,
      })),
      primaryRole:
        primary !== null
          ? { slug: primary.slug, name: primary.name, isPlatform: primary.isPlatform }
          : null,
    };
  },
});

/** Read-only, paginated audit log view for /platform/audit-log. */
export const listAuditLog = query({
  args: {
    entityTable: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const limit = Math.min(100, args.limit ?? 50);
    const base = ctx.db.query("auditLog");
    if (args.entityTable) {
      return (
        await ctx.db
          .query("auditLog")
          .withIndex("by_entity", (q) => q.eq("entityTable", args.entityTable!))
          .order("desc")
          .take(limit)
      );
    }
    return (
      await base.order("desc").take(limit)
    );
  },
});

/** Read-only, paginated audit log view for /platform/audit. */
export const listAuditLogPage = query({
  args: {
    entityTable: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.nullable(v.string())),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return readAuditLog(ctx, {
      entityTable: args.entityTable,
      limit: args.limit,
      cursor: args.cursor ?? null,
    });
  },
});

/**
 * Report the state of the background audit-chain verification sweep — a low
 * constant-cost read of the canonical `migrationRuns` row the sweep updates.
 * The sweep itself (see `auditChainVerify.ts`) verifies every sealed row from
 * the genesis sentinel forward; this query only reports its status, coverage
 * range and completion time so the UI can label the result honestly without
 * re-walking the chain. Rows written before L2 remain readable but
 * intentionally have no integrity hash.
 */
export const getAuditChainHealth = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const run = await ctx.db
      .query("migrationRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", AUDIT_CHAIN_VERIFY_RUN_ID))
      .first();
    if (run === null) {
      return {
        status: "never",
        valid: false,
        issue: null,
        checkedEntries: 0,
        firstSequence: null,
        lastSequence: null,
        startsAt: null,
        endsAt: null,
        legacySkipped: 0,
        runningSince: null,
        completedAt: null,
        lastGoodAt: null,
      };
    }

    const manifest = (run.manifest ?? {}) as Record<string, unknown>;
    const issue = typeof manifest.issue === "string" ? (manifest.issue as string) : null;
    const lastGoodAt = typeof manifest.lastCompletedAt === "number" ? manifest.lastCompletedAt : null;
    const lastSummary = (manifest.lastSummary ?? null) as Record<string, unknown> | null;
    const numberField = (value: unknown): number | null => (typeof value === "number" ? value : null);

    // `running` exposes the in-progress sweep's progress plus the last clean
    // completion; `completed`/`failed` describe the latest attempt outright.
    const described = run.status === "running"
      ? { checkedEntries: Math.max(run.rowsProcessed, 0), firstSequence: numberField(manifest.firstSequence), lastSequence: numberField(manifest.lastSequence), startsAt: numberField(manifest.startsAt), endsAt: numberField(manifest.endsAt), legacySkipped: numberField(manifest.legacySkipped) ?? 0, valid: lastSummary !== null, completedAt: null }
      : { checkedEntries: Math.max(run.rowsProcessed, 0), firstSequence: numberField(manifest.firstSequence), lastSequence: numberField(manifest.lastSequence), startsAt: numberField(manifest.startsAt), endsAt: numberField(manifest.endsAt), legacySkipped: numberField(manifest.legacySkipped) ?? 0, valid: issue === null, completedAt: run.completedAt ?? null };

    return {
      status: run.status,
      valid: described.valid,
      issue: run.status === "running" ? null : issue,
      checkedEntries: described.checkedEntries,
      firstSequence: described.firstSequence,
      lastSequence: described.lastSequence,
      startsAt: described.startsAt,
      endsAt: described.endsAt,
      legacySkipped: described.legacySkipped,
      runningSince: run.status === "running" ? (run.startedAt ?? null) : null,
      completedAt: described.completedAt,
      lastGoodAt,
    };
  },
});

/**
 * Single platform-security snapshot for /platform/security: tenant identity
 * coverage, staff MFA posture, WorkOS webhook queue + delivery health, and
 * current feature-flag states. All counts are bounded to small reads.
 */
export const getPlatformSecurityOverview = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requirePlatformUser(ctx);
    const [tenants, users, roles, workosEvents, deliveries, featureFlagRows] = await Promise.all([
      ctx.db.query("tenants").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("roles").collect(),
      ctx.db.query("workosWebhookEvents").collect(),
      ctx.db.query("webhookDeliveryLog").withIndex("by_receivedAt").order("desc").take(300),
      ctx.db.query("featureFlags").collect(),
    ]);

    const staff: Array<{
      userId: Id<"users">;
      name: string | null;
      email: string | null;
      roles: string[];
      mfaOptional: true;
      mfaEnrolled: boolean;
      mfaEnrolledAt: number | null;
      status: "enrolled" | "not_enrolled";
    }> = [];
    for (const user of users) {
      if (user.deletedAt !== undefined) continue;
      const resolved = await resolveRoles(ctx, user);
      if (!isPlatformUser(resolved)) continue;
      const enrolled = user.mfaEnrolled === true;
      staff.push({
        userId: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
        roles: resolved.map((role) => role.slug),
        mfaOptional: true,
        mfaEnrolled: enrolled,
        mfaEnrolledAt: user.mfaEnrolledAt ?? null,
        status: enrolled ? "enrolled" : "not_enrolled",
      });
    }

    const eventStatusCounts = { received: 0, completed: 0, retry: 0, quarantined: 0 };
    for (const event of workosEvents) {
      if (event.status in eventStatusCounts) eventStatusCounts[event.status] += 1;
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const deliveries24h = deliveries.filter((delivery) => now - delivery.receivedAt <= dayMs);

    // The platform panel owns the featureFlags table. Do not read the legacy
    // system_settings booleans here: they neither represent percentage/
    // tenant rollouts nor reflect changes made through /platform/feature-flags.
    const featureFlags = Object.fromEntries(
      featureFlagRows.map((flag) => [flag.key, flag.enabled]),
    );

    return {
      tenantOverview: {
        total: tenants.length,
        active: tenants.filter((tenant) => tenant.status === "active").length,
        trial: tenants.filter((tenant) => tenant.status === "trial").length,
        suspended: tenants.filter((tenant) => tenant.status === "suspended").length,
        cancelled: tenants.filter((tenant) => tenant.status === "cancelled").length,
        identityMapped: tenants.filter((tenant) => tenant.workosOrganizationId !== undefined).length,
      },
      staff,
      staffMfaEnrolled: staff.filter((entry) => entry.mfaEnrolled).length,
      mfaMode: "optional" as const,
      workosEvents: eventStatusCounts,
      deliveries24h: {
        total: deliveries24h.length,
        processed: deliveries24h.filter((delivery) => delivery.processed).length,
        signatureInvalid: deliveries24h.filter((delivery) => !delivery.signatureValid).length,
      },
      featureFlags,
      currentUserId: actor._id,
    };
  },
});

/** Distinct entity types present in recent audit entries, for the /platform/audit filter. Bounded to a recent sample so the filter never drifts from what writers actually emit. */
export const listAuditEntityTables = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const recent = await ctx.db.query("auditLog").order("desc").take(2000);
    return Array.from(new Set(recent.map((entry) => entry.entityTable))).sort();
  },
});
