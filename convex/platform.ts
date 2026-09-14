import { v } from "convex/values";
import { query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { listAuditLog as readAuditLog } from "./lib/auditLog";
import { verifyAuditChain, type SealedAuditEntry } from "./lib/auditChainCore";
import {
  isPlatformUser,
  permissionsOf,
  requirePlatformUser,
  resolveRoles,
  resolveUserByIdentity,
} from "./lib/auth";
import { MANDATORY_MFA_ROLES } from "./lib/mfa";

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
 * Verify the most recent sealed audit links without exposing their payloads.
 * The bounded window keeps this platform query predictable as the log grows;
 * the UI labels a partial window honestly rather than claiming a full-history
 * verification. Rows written before L2 remain readable but intentionally have
 * no integrity hash.
 */
export const getAuditChainHealth = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const windowSize = 2_000;
    const newestFirst = await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("desc")
      .take(windowSize);
    const sealed = newestFirst
      .filter((entry) => entry.hash !== undefined && entry.prevHash !== undefined && entry.chainSequence !== undefined)
      .reverse()
      .map((entry): SealedAuditEntry => ({
        hash: entry.hash!,
        prevHash: entry.prevHash!,
        chainSequence: entry.chainSequence!,
        action: entry.action,
        entityTable: entry.entityTable,
        entityId: entry.entityId,
        changedBy: entry.changedBy,
        beforeJson: entry.beforeJson,
        afterJson: entry.afterJson,
        timestamp: entry.timestamp,
        ip: entry.ip,
      }));
    const first = sealed[0];
    const last = sealed[sealed.length - 1];
    const verification = await verifyAuditChain(sealed, {
      requireGenesis: first?.chainSequence === 1,
    });

    return {
      ...verification,
      sealedEntries: sealed.length,
      legacyEntriesInWindow: newestFirst.length - sealed.length,
      windowSize,
      windowLimited: newestFirst.length === windowSize,
      startsAt: first?.timestamp ?? null,
      endsAt: last?.timestamp ?? null,
      firstSequence: first?.chainSequence ?? null,
      lastSequence: last?.chainSequence ?? null,
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
      mandatoryMfa: boolean;
      mfaEnrolled: boolean;
      mfaEnrolledAt: number | null;
      compliance: "compliant" | "missing_mfa" | "n/a";
    }> = [];
    for (const user of users) {
      if (user.deletedAt !== undefined) continue;
      const resolved = await resolveRoles(ctx, user);
      if (!isPlatformUser(resolved)) continue;
      const mandatoryMfa = resolved.some((role) => (MANDATORY_MFA_ROLES as readonly string[]).includes(role.slug));
      const enrolled = user.mfaEnrolled === true;
      staff.push({
        userId: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
        roles: resolved.map((role) => role.slug),
        mandatoryMfa,
        mfaEnrolled: enrolled,
        mfaEnrolledAt: user.mfaEnrolledAt ?? null,
        compliance: mandatoryMfa ? (enrolled ? "compliant" : "missing_mfa") : "n/a",
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
      staffMissingMfa: staff.filter((entry) => entry.mandatoryMfa && !entry.mfaEnrolled).length,
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
