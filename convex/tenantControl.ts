import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { logAudit } from "./lib/auditLog";
import { requirePlatformAdmin, requirePlatformSubRole, requirePlatformUser, resolveRoles } from "./lib/auth";
import { PLATFORM_SUB_ROLE_MAP } from "./lib/permissions";
import { assertMfaCompliance } from "./lib/mfa";
import { requireTenantMember } from "./lib/tenant";
import { assertCanPurge, assertCanRequestDeletion, assertCanRestore, purgeEligibleAt } from "./lib/tenantLifecycleCore";
import { normalizeTenantRegistration } from "./lib/tenantProvisioning";
import { getWorkosOrganizationMembership } from "./workos";

const tenantStatus = v.union(
  v.literal("trial"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("cancelled"),
  v.literal("pending_deletion"),
);

const entitlementStatus = v.union(
  v.literal("trial"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("suspended"),
);

/** Platform-only tenant estate inventory. It intentionally includes no tenant-owned records. */
export const listForPlatform = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const tenants = await ctx.db.query("tenants").order("desc").collect();
    return Promise.all(tenants.filter((tenant) => tenant.deletedAt === undefined).map(async (tenant) => {
      const [memberships, entitlement] = await Promise.all([
        ctx.db.query("tenantMemberships").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).collect(),
        ctx.db.query("entitlements").withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id)).order("desc").first(),
      ]);
      return {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        country: tenant.country,
        timezone: tenant.timezone,
        currency: tenant.currency,
        status: tenant.status,
        workosOrganizationId: tenant.workosOrganizationId ?? null,
        membershipCount: memberships.filter((membership) => membership.status === "active").length,
        entitlement: entitlement
          ? {
              planId: entitlement.planId,
              status: entitlement.status,
              startsAt: entitlement.startsAt ?? null,
              expiresAt: entitlement.expiresAt ?? null,
              trialEndsAt: entitlement.trialEndsAt ?? null,
            }
          : null,
        createdAt: tenant.createdAt,
      };
    }));
  },
});

/** The tenant-side workspace has no client-selected tenant identifier. */
export const getCurrentWorkspace = query({
  args: {},
  handler: async (ctx) => {
    const tenantId = await requireTenantMember(ctx);
    const tenant = await ctx.db.get(tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("Unauthorized: tenant is unavailable");

    const [memberships, markets, routers, openAlerts, entitlements] = await Promise.all([
      ctx.db.query("tenantMemberships").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("routers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("alerts").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("entitlements").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).order("desc").first(),
    ]);
    return {
      tenant: {
        _id: tenant._id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        country: tenant.country,
        timezone: tenant.timezone,
        currency: tenant.currency,
      },
      activeMembers: memberships.filter((membership) => membership.status === "active").length,
      activeMarkets: markets.filter((market) => market.status !== "deleted" && market.lifecycleStatus === "active").length,
      activeRouters: routers.filter((router) => router.archivedAt === undefined).length,
      openAlerts: openAlerts.filter((alert) => alert.alertStatus === "open").length,
      entitlement: entitlements ? { planId: entitlements.planId, status: entitlements.status } : null,
    };
  },
});

/** Suspend/reactivate without deleting records or severing WorkOS history. */
export const setStatus = mutation({
  args: { tenantId: v.id("tenants"), status: tenantStatus },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant not found");
    if (args.status === "cancelled") {
      throw new Error("Cancellation requires the retention/offboarding workflow; direct cancellation is disabled");
    }
    if (args.status === "pending_deletion") {
      throw new Error("Deletion must be requested through requestTenantDeletion");
    }
    if (tenant.status === "pending_deletion") {
      throw new Error("Tenant is pending deletion; use restoreTenant to reinstate it");
    }
    if (tenant.status === args.status) return { changed: false };
    await ctx.db.patch(tenant._id, { status: args.status, updatedAt: Date.now() });
    await logAudit(ctx, {
      action: "tenant.statusChanged",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before: { status: tenant.status },
      after: { status: args.status },
    });
    return { changed: true };
  },
});

/**
 * Open the A3 retention window. Status becomes `pending_deletion` and a purge
 * is eligible only after the 30-day window; the base (suspend/restore) flow
 * stays fully reversible until then.
 */
export const requestTenantDeletion = mutation({
  args: { tenantId: v.id("tenants"), deleteReason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");
    const now = Date.now();
    assertCanRequestDeletion(tenant);
    await ctx.db.patch(tenant._id, {
      status: "pending_deletion",
      deletionRequestedAt: now,
      deletionRequestedBy: actor._id,
      deleteReason: args.deleteReason,
      purgeEligibleAt: purgeEligibleAt(now),
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "tenant.deletionRequested",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before: { status: tenant.status },
      after: { status: "pending_deletion", purgeEligibleAt: purgeEligibleAt(now), reason: args.deleteReason },
    });
    return { changed: true };
  },
});

/** Reinstate a suspended or pending-deletion tenant; clears the retention window. */
export const restoreTenant = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");
    const now = Date.now();
    assertCanRestore(tenant);
    await ctx.db.patch(tenant._id, {
      status: "active",
      deletionRequestedAt: undefined,
      deletionRequestedBy: undefined,
      deleteReason: undefined,
      purgeEligibleAt: undefined,
      restoredAt: now,
      restoredBy: actor._id,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "tenant.restored",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before: { status: tenant.status, restoredAt: tenant.restoredAt ?? null },
      after: { status: "active", restoredAt: now },
    });
    return { changed: true };
  },
});

/**
 * Finalize a pending-deletion tenant AFTER the retention window has elapsed
 * (super-admin only — `platform_ops` can never reach a purge). A soft mark
 * only: the row and its audit trail are retained per the retention workflow.
 */
export const purgeTenant = mutation({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");
    const now = Date.now();
    assertCanPurge(tenant, now);
    await ctx.db.patch(tenant._id, {
      deletedAt: now,
      deletedBy: actor._id,
      deleteReason: tenant.deleteReason ?? "Purged after retention window",
      purgedAt: now,
      purgedBy: actor._id,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "tenant.purged",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before: { deletionRequestedAt: tenant.deletionRequestedAt ?? null, purgeEligibleAt: tenant.purgeEligibleAt ?? null },
      after: { deletedAt: now, purgedAt: now, reason: tenant.deleteReason ?? null },
    });
    return { changed: true };
  },
});

/** Platform-side tenant detail: identity mapping, entitlement, and member roster. Returns null for missing/deleted tenants so the client can show a proper empty state. */
export const getTenantDetail = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) return null;
    const [memberships, entitlement] = await Promise.all([
      ctx.db
        .query("tenantMemberships")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .collect(),
      ctx.db
        .query("entitlements")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .order("desc")
        .first(),
    ]);
    const members = await Promise.all(memberships.filter((membership) => membership.status !== "revoked").map(async (membership) => {
      const user = await ctx.db.get(membership.userId);
      return {
        userId: membership.userId,
        name: user?.name ?? null,
        email: user?.email ?? null,
        image: user?.image ?? null,
        role: membership.role,
        status: membership.status,
        joinedAt: membership.joinedAt ?? null,
      };
    }));
    const retentionDaysRemaining = tenant.purgeEligibleAt !== undefined
      ? Math.max(0, Math.ceil((tenant.purgeEligibleAt - Date.now()) / (24 * 60 * 60 * 1000)))
      : null;
    const purgeEligible = tenant.purgeEligibleAt !== undefined && Date.now() >= tenant.purgeEligibleAt;
    return {
      _id: tenant._id,
      name: tenant.name,
      slug: tenant.slug,
      country: tenant.country,
      timezone: tenant.timezone,
      currency: tenant.currency,
      status: tenant.status,
      workosOrganizationId: tenant.workosOrganizationId ?? null,
      createdAt: tenant.createdAt,
      updatedAt: tenant.updatedAt,
      deletionRequestedAt: tenant.deletionRequestedAt ?? null,
      deletionRequestedBy: tenant.deletionRequestedBy ?? null,
      deleteReason: tenant.deleteReason ?? null,
      purgeEligibleAt: tenant.purgeEligibleAt ?? null,
      purgedAt: tenant.purgedAt ?? null,
      restoredAt: tenant.restoredAt ?? null,
      retentionDaysRemaining,
      purgeEligible,
      entitlement: entitlement
        ? {
            planId: entitlement.planId,
            status: entitlement.status,
            startsAt: entitlement.startsAt ?? null,
            expiresAt: entitlement.expiresAt ?? null,
            trialEndsAt: entitlement.trialEndsAt ?? null,
          }
        : null,
      activeMemberCount: memberships.filter((membership) => membership.status === "active").length,
      members,
    };
  },
});

/** Plan/entitlement control for a tenant subscription (Platform admin+). */
export const setEntitlement = mutation({
  args: {
    tenantId: v.id("tenants"),
    planId: v.string(),
    status: entitlementStatus,
    startsAt: v.optional(v.number()),
    expiresAt: v.optional(v.number()),
    trialEndsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant not found");

    const auditAfter = {
      planId: args.planId,
      status: args.status,
      startsAt: args.startsAt ?? null,
      expiresAt: args.expiresAt ?? null,
      trialEndsAt: args.trialEndsAt ?? null,
    };
    const fields = {
      planId: args.planId,
      status: args.status,
      startsAt: args.startsAt,
      expiresAt: args.expiresAt,
      trialEndsAt: args.trialEndsAt,
    };
    const existing = await ctx.db
      .query("entitlements")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .order("desc")
      .first();
    const now = Date.now();

    if (existing) {
      const before = {
        planId: existing.planId,
        status: existing.status,
        startsAt: existing.startsAt ?? null,
        expiresAt: existing.expiresAt ?? null,
        trialEndsAt: existing.trialEndsAt ?? null,
      };
      await ctx.db.patch(existing._id, { ...fields, updatedAt: now });
      await logAudit(ctx, {
        action: "tenant.entitlementChanged",
        entityTable: "tenants",
        entityId: tenant._id,
        changedBy: actor._id,
        before,
        after: auditAfter,
      });
      return { changed: true };
    }

    await ctx.db.insert("entitlements", { tenantId: tenant._id, ...fields, createdAt: now, updatedAt: now });
    await logAudit(ctx, {
      action: "tenant.entitlementSet",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      after: auditAfter,
    });
    return { changed: true };
  },
});

/** Internal authorization bridge for the action below. */
export const assertProvisioner = internalQuery({
  args: { workosUserId: v.string() },
  handler: async (ctx, args) => {
    const actor = await ctx.db.query("users").withIndex("by_workosUserId", (q) => q.eq("workosUserId", args.workosUserId)).first();
    if (!actor || actor.deletedAt !== undefined || actor.isActive === false) throw new Error("Unauthorized: platform administrator required");
    const roles = await resolveRoles(ctx, actor);
    const allowed = ["platform_super_admin", "platform_ops"].flatMap((sub) => PLATFORM_SUB_ROLE_MAP[sub] ?? [sub]);
    if (!roles.some((role) => allowed.includes(role.slug))) {
      throw new Error("Unauthorized: platform administrator required");
    }
    assertMfaCompliance(actor, roles.map((role) => role.slug));
  },
});

/** Persist only a tenant whose WorkOS organization and owner membership were verified by the action. */
export const registerVerifiedTenant = internalMutation({
  args: {
    actorWorkosUserId: v.string(),
    ownerWorkosUserId: v.string(),
    workosOrganizationId: v.string(),
    name: v.string(),
    slug: v.string(),
    country: v.string(),
    timezone: v.string(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.query("users").withIndex("by_workosUserId", (q) => q.eq("workosUserId", args.actorWorkosUserId)).first();
    if (!actor) throw new Error("Unauthorized: platform administrator required");
    const [bySlug, byOrganization] = await Promise.all([
      ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first(),
      ctx.db.query("tenants").withIndex("by_workosOrganizationId", (q) => q.eq("workosOrganizationId", args.workosOrganizationId)).first(),
    ]);
    if (bySlug) throw new Error("A tenant already uses this slug");
    if (byOrganization) throw new Error("This WorkOS organization is already registered");

    const now = Date.now();
    const tenantId = await ctx.db.insert("tenants", {
      name: args.name,
      slug: args.slug,
      country: args.country,
      timezone: args.timezone,
      currency: args.currency,
      status: "trial",
      workosOrganizationId: args.workosOrganizationId,
      createdAt: now,
      updatedAt: now,
    });
    let owner = await ctx.db.query("users").withIndex("by_workosUserId", (q) => q.eq("workosUserId", args.ownerWorkosUserId)).first();
    if (!owner) {
      const ownerId = await ctx.db.insert("users", { workosUserId: args.ownerWorkosUserId, isActive: true });
      owner = await ctx.db.get(ownerId);
    }
    if (!owner || owner.deletedAt !== undefined || owner.isActive === false) {
      throw new Error("The confirmed tenant owner is not an active local identity");
    }
    await ctx.db.insert("tenantMemberships", {
      userId: owner._id,
      tenantId,
      role: "tenant_admin",
      status: "active",
      joinedAt: now,
    });
    await logAudit(ctx, {
      action: "tenant.registered",
      entityTable: "tenants",
      entityId: tenantId,
      changedBy: actor._id,
      after: { workosOrganizationId: args.workosOrganizationId, ownerWorkosUserId: args.ownerWorkosUserId, status: "trial" },
    });
    return { tenantId };
  },
});

/**
 * Registers an already-created WorkOS tenant organization only after its
 * supplied owner is confirmed to hold an active organization membership.
 * This action deliberately does not create WorkOS organizations or invitations.
 */
export const registerExistingOrganization = action({
  args: {
    name: v.string(),
    slug: v.string(),
    country: v.string(),
    timezone: v.string(),
    currency: v.string(),
    workosOrganizationId: v.string(),
    ownerWorkosUserId: v.string(),
  },
  handler: async (ctx, args): Promise<{ tenantId: Id<"tenants"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const registration = normalizeTenantRegistration(args);
    await ctx.runQuery(internal.tenantControl.assertProvisioner, { workosUserId: identity.subject });
    const membership = await getWorkosOrganizationMembership(registration.workosOrganizationId, registration.ownerWorkosUserId);
    if (!membership || membership.status !== "active") {
      throw new Error("The supplied tenant owner does not have an active membership in that WorkOS organization");
    }
    return ctx.runMutation(internal.tenantControl.registerVerifiedTenant, {
      actorWorkosUserId: identity.subject,
      ...registration,
    });
  },
});
