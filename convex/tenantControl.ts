import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { logAudit } from "./lib/auditLog";
import { requirePlatformAdmin, requirePlatformSubRole, requirePlatformUser, resolveRoles, resolveUserByIdentity } from "./lib/auth";
import { PLATFORM_SUB_ROLE_MAP } from "./lib/permissions";
import { canTenantOperate, resolveTenantFromAuth } from "./lib/tenant";
import {
  normalizeAutomatedTenantOnboarding,
  normalizeTenantRegistration,
  tenantOrganizationExternalId,
} from "./lib/tenantProvisioning";
import {
  createWorkosInvitation,
  createWorkosOrganization,
  getWorkosOrganizationByExternalId,
  getWorkosOrganizationMembership,
} from "./workos";

const tenantStatus = v.union(
  v.literal("provisioning"),
  v.literal("trial"),
  v.literal("active"),
  v.literal("suspended"),
  v.literal("cancelled"),
);

const entitlementStatus = v.union(
  v.literal("trial"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("suspended"),
);

type WorkspaceSetupReason =
  | "authentication_required"
  | "tenant_unconfigured"
  | "tenant_unavailable"
  | "account_inactive"
  | "tenant_membership_required";

type TenantWorkspaceResult =
  | {
      status: "ready";
      workspace: {
        tenant: {
          _id: Id<"tenants">;
          name: string;
          slug: string;
          status: "provisioning" | "trial" | "active" | "suspended" | "cancelled";
          country: string;
          timezone: string;
          currency: string;
        };
        activeMembers: number;
        activeMarkets: number;
        entitlement: { planId: string; status: string } | null;
      };
    }
  | { status: "setup_required"; reason: WorkspaceSetupReason };

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

/**
 * The tenant-side workspace has no client-selected tenant identifier.
 * Missing tenancy is an expected onboarding state, not a server exception.
 */
export const getCurrentWorkspace = query({
  args: {},
  handler: async (ctx): Promise<TenantWorkspaceResult> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { status: "setup_required", reason: "authentication_required" };

    const tenantId = await resolveTenantFromAuth(ctx);
    if (!tenantId) return { status: "setup_required", reason: "tenant_unconfigured" };

    const tenant = await ctx.db.get(tenantId);
    if (!tenant || tenant.deletedAt !== undefined || !canTenantOperate(tenant.status)) {
      return { status: "setup_required", reason: "tenant_unavailable" };
    }

    const user = await resolveUserByIdentity(ctx);
    if (!user || user.deletedAt !== undefined || user.isActive === false) {
      return { status: "setup_required", reason: "account_inactive" };
    }

    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", user._id).eq("tenantId", tenantId))
      .first();
    if (!membership || membership.status !== "active") {
      return { status: "setup_required", reason: "tenant_membership_required" };
    }

    const [memberships, markets, entitlements] = await Promise.all([
      ctx.db.query("tenantMemberships").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ctx.db.query("entitlements").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).order("desc").first(),
    ]);
    return {
      status: "ready",
      workspace: {
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
        entitlement: entitlements ? { planId: entitlements.planId, status: entitlements.status } : null,
      },
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
    if (args.status === "provisioning") throw new Error("Provisioning status is managed by secure onboarding only");
    if (args.status === "cancelled") {
      throw new Error("Cancellation requires the retention/offboarding workflow; direct cancellation is disabled");
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
  },
});

/** Start a durable, non-sensitive run before contacting the identity provider. */
export const prepareAutomatedTenantOnboarding = internalMutation({
  args: {
    actorWorkosUserId: v.string(),
    name: v.string(),
    slug: v.string(),
    country: v.string(),
    timezone: v.string(),
    currency: v.string(),
    ownerEmail: v.string(),
    ownerName: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", args.actorWorkosUserId))
      .first();
    if (!actor || actor.deletedAt !== undefined || actor.isActive === false) {
      throw new Error("Unauthorized: platform administrator required");
    }
    const tenant = await ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    if (tenant && tenant.deletedAt === undefined) throw new Error("A tenant already uses this slug");

    const existing = await ctx.db
      .query("tenantOnboardingRuns")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .order("desc")
      .first();
    if (existing) {
      return {
        runId: existing._id,
        workosOrganizationId: existing.workosOrganizationId,
        workosInvitationId: existing.workosInvitationId,
        tenantId: existing.tenantId,
      };
    }

    const now = Date.now();
    const runId = await ctx.db.insert("tenantOnboardingRuns", {
      name: args.name,
      slug: args.slug,
      country: args.country,
      timezone: args.timezone,
      currency: args.currency,
      ownerEmail: args.ownerEmail,
      ownerName: args.ownerName,
      state: "pending",
      createdBy: actor._id,
      createdAt: now,
      updatedAt: now,
    });
    return { runId, workosOrganizationId: undefined, workosInvitationId: undefined, tenantId: undefined };
  },
});

/** Persist non-secret provider delivery references so a retry does not recreate the workspace. */
export const recordAutomatedTenantIdentity = internalMutation({
  args: {
    runId: v.id("tenantOnboardingRuns"),
    workosOrganizationId: v.optional(v.string()),
    workosInvitationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Tenant onboarding run not found");
    if (run.tenantId) return;
    await ctx.db.patch(run._id, {
      workosOrganizationId: args.workosOrganizationId ?? run.workosOrganizationId,
      workosInvitationId: args.workosInvitationId ?? run.workosInvitationId,
      updatedAt: Date.now(),
    });
  },
});

/** Turn a fully prepared background run into an access-blocked tenant record. */
export const finalizeAutomatedTenantOnboarding = internalMutation({
  args: { runId: v.id("tenantOnboardingRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Tenant onboarding run not found");
    if (run.tenantId) return { tenantId: run.tenantId };
    if (!run.workosOrganizationId || !run.workosInvitationId) {
      throw new Error("Tenant onboarding has not completed secure invitation delivery");
    }
    const [bySlug, byOrganization] = await Promise.all([
      ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", run.slug)).first(),
      ctx.db.query("tenants").withIndex("by_workosOrganizationId", (q) => q.eq("workosOrganizationId", run.workosOrganizationId!)).first(),
    ]);
    if (bySlug || byOrganization) throw new Error("A tenant already uses this workspace identity");
    const now = Date.now();
    const tenantId = await ctx.db.insert("tenants", {
      name: run.name,
      slug: run.slug,
      country: run.country,
      timezone: run.timezone,
      currency: run.currency,
      status: "provisioning",
      workosOrganizationId: run.workosOrganizationId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.patch(run._id, { tenantId, state: "invited", updatedAt: now });
    await logAudit(ctx, {
      action: "tenant.onboardingStarted",
      entityTable: "tenants",
      entityId: tenantId,
      changedBy: run.createdBy,
      after: { status: "provisioning", ownerEmail: run.ownerEmail },
    });
    return { tenantId };
  },
});

/** Record a safe, generic failure state without exposing provider details to the UI. */
export const markAutomatedTenantOnboardingFailed = internalMutation({
  args: { runId: v.id("tenantOnboardingRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run || run.tenantId) return;
    await ctx.db.patch(run._id, { state: "failed", updatedAt: Date.now() });
  },
});

/** Enable the tenant only after WorkOS confirms an active tenant membership. */
export const activateProvisionedTenant = internalMutation({
  args: { tenantId: v.id("tenants"), ownerUserId: v.id("users") },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined || tenant.status !== "provisioning") return;
    const owner = await ctx.db.get(args.ownerUserId);
    if (!owner || owner.deletedAt !== undefined || owner.isActive === false) return;
    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", args.ownerUserId).eq("tenantId", args.tenantId))
      .first();
    if (!membership || membership.status !== "active" || membership.role !== "tenant_admin") return;
    const now = Date.now();
    await ctx.db.patch(tenant._id, { status: "trial", updatedAt: now });
    const run = await ctx.db
      .query("tenantOnboardingRuns")
      .withIndex("by_tenant", (q) => q.eq("tenantId", tenant._id))
      .first();
    if (run) await ctx.db.patch(run._id, { state: "completed", updatedAt: now });
    await logAudit(ctx, {
      action: "tenant.onboardingCompleted",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: owner._id,
      before: { status: "provisioning" },
      after: { status: "trial" },
    });
  },
});

/**
 * Automatic onboarding path. Platform staff enter business and administrator
 * details only; provider identifiers and invitation delivery remain backend-only.
 */
export const provisionTenant = action({
  args: {
    name: v.string(), slug: v.string(), country: v.string(), timezone: v.string(), currency: v.string(),
    ownerEmail: v.string(), ownerName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<
    | { tenantId: Id<"tenants">; status: "provisioning" }
    | { status: "authentication_required" | "unavailable" }
  > => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { status: "authentication_required" };
    const onboarding = normalizeAutomatedTenantOnboarding(args);
    try {
      await ctx.runQuery(internal.tenantControl.assertProvisioner, { workosUserId: identity.subject });
      const run = await ctx.runMutation(internal.tenantControl.prepareAutomatedTenantOnboarding, {
        actorWorkosUserId: identity.subject,
        ...onboarding,
      });
      if (run.tenantId) return { tenantId: run.tenantId, status: "provisioning" };
      const externalId = tenantOrganizationExternalId(onboarding.slug);
      const organization = run.workosOrganizationId
        ? { id: run.workosOrganizationId }
        : (await getWorkosOrganizationByExternalId(externalId)) ?? await createWorkosOrganization(onboarding.name, externalId);
      await ctx.runMutation(internal.tenantControl.recordAutomatedTenantIdentity, {
        runId: run.runId, workosOrganizationId: organization.id,
      });
      if (!run.workosInvitationId) {
        const invitation = await createWorkosInvitation(onboarding.ownerEmail, organization.id, "tenant_admin");
        await ctx.runMutation(internal.tenantControl.recordAutomatedTenantIdentity, {
          runId: run.runId, workosInvitationId: invitation.id,
        });
      }
      const result = await ctx.runMutation(internal.tenantControl.finalizeAutomatedTenantOnboarding, { runId: run.runId });
      return { tenantId: result.tenantId, status: "provisioning" };
    } catch (error) {
      // A run is available only after authorization succeeds. Preserve it for
      // a retry, but never disclose provider diagnostics to the browser.
      const run = await ctx.runMutation(internal.tenantControl.prepareAutomatedTenantOnboarding, {
        actorWorkosUserId: identity.subject,
        ...onboarding,
      }).catch(() => null);
      if (run) await ctx.runMutation(internal.tenantControl.markAutomatedTenantOnboardingFailed, { runId: run.runId });
      console.error("Tenant onboarding failed", error);
      return { status: "unavailable" };
    }
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
