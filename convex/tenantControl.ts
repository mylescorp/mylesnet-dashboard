import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import type { QueryCtx } from "./_generated/server";
import { logAudit } from "./lib/auditLog";
import { requirePlatformSubRole, requirePlatformUser, resolveRoles, resolveUserByIdentity } from "./lib/auth";
import { PLATFORM_SUB_ROLE_MAP } from "./lib/permissions";
import { canTenantOperate, resolveTenantFromAuth } from "./lib/tenant";
import { decideTenantLifecycleTransition } from "./lib/tenantLifecycleCore";
import {
  normalizeAutomatedTenantOnboarding,
  normalizeTenantRegistration,
  tenantOrganizationExternalId,
} from "./lib/tenantProvisioning";
import {
  createWorkosOrganization,
  addWorkosOrganizationMembership,
  createWorkosUser,
  getWorkosOrganizationByExternalId,
  getWorkosOrganizationMembership,
} from "./workos";

const entitlementStatus = v.union(
  v.literal("trial"),
  v.literal("active"),
  v.literal("expired"),
  v.literal("suspended"),
);

const TENANT_DELETION_GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

type WorkspaceSetupReason =
  | "authentication_required"
  | "tenant_unconfigured"
  | "tenant_unavailable"
  | "tenant_suspended"
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
          status: "provisioning" | "trial" | "active" | "suspended" | "pending_deletion" | "cancelled";
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

async function toPlatformTenant(ctx: QueryCtx, tenant: Doc<"tenants">) {
  const [memberships, entitlement, markets] = await Promise.all([
    ctx.db.query("tenantMemberships").withIndex("by_tenant", q => q.eq("tenantId", tenant._id)).collect(),
    ctx.db.query("entitlements").withIndex("by_tenant", q => q.eq("tenantId", tenant._id)).order("desc").first(),
    ctx.db.query("markets").withIndex("by_tenant", q => q.eq("tenantId", tenant._id)).collect(),
  ]);
  const ownerMembership = memberships.find(membership => membership.status === "active" && membership.role === "tenant_admin");
  const owner = ownerMembership ? await ctx.db.get(ownerMembership.userId) : null;
  return {
    _id: tenant._id,
    name: tenant.name,
    slug: tenant.slug,
    country: tenant.country,
    timezone: tenant.timezone,
    currency: tenant.currency,
    status: tenant.status,
    scheduledDeletionAt: tenant.scheduledDeletionAt ?? null,
    workosOrganizationId: tenant.workosOrganizationId ?? null,
    membershipCount: memberships.filter(membership => membership.status === "active").length,
    accountOwner: owner && owner.deletedAt === undefined && owner.isActive !== false ? { name: owner.name ?? null, email: owner.email ?? null } : null,
    marketCount: markets.filter(market => market.status !== "deleted").length,
    subscriberCount: tenant.subscriberCount ?? null,
    entitlement: entitlement ? {
      planId: entitlement.planId,
      status: entitlement.status,
      startsAt: entitlement.startsAt ?? null,
      expiresAt: entitlement.expiresAt ?? null,
      trialEndsAt: entitlement.trialEndsAt ?? null,
    } : null,
    createdAt: tenant.createdAt,
  };
}

/**
 * Populate a legacy tenant's denormalized subscriber total in bounded pages.
 * Start once per existing tenant with an internal invocation after deployment.
 * Subscriber create/archive/restore writes are paused for this tenant while
 * the paginated scan runs. That gives every page one stable data set and
 * prevents a stale final total from overwriting concurrent changes.
 */
export const backfillTenantSubscriberCount = internalMutation({
  args: {
    tenantId: v.id("tenants"),
    cursor: v.optional(v.union(v.string(), v.null())),
    accumulatedCount: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant) throw new Error("Tenant not found");
    if (!args.cursor) {
      if (tenant.subscriberCountBackfillRunning) throw new Error("Subscriber count backfill is already running");
      await ctx.db.patch(args.tenantId, { subscriberCountBackfillRunning: true });
    }
    const page = await ctx.db
      .query("subscribers")
      .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
      .paginate({ numItems: 500, cursor: args.cursor ?? null });
    const accumulatedCount = (args.accumulatedCount ?? 0) + page.page.filter((row) => row.deletedAt === undefined).length;
    if (page.isDone) {
      await ctx.db.patch(args.tenantId, { subscriberCount: accumulatedCount, subscriberCountBackfillRunning: false });
      return { complete: true, subscriberCount: accumulatedCount };
    }
    await ctx.scheduler.runAfter(0, internal.tenantControl.backfillTenantSubscriberCount, {
      tenantId: args.tenantId,
      cursor: page.continueCursor,
      accumulatedCount,
    });
    return { complete: false, subscriberCount: null };
  },
});

/** Platform-only tenant estate inventory. It intentionally includes no tenant-owned records. */
export const listForPlatform = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const tenants = await ctx.db.query("tenants").order("desc").collect();
    return Promise.all(tenants.filter(tenant => tenant.deletedAt === undefined).map(tenant => toPlatformTenant(ctx, tenant)));
  },
});

/** Cursor-paged directory query; only the requested tenant page is joined. */
export const listForPlatformPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const page = await ctx.db.query("tenants").withIndex("by_createdAt").order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(50, Math.floor(args.paginationOpts.numItems))),
    });
    return {
      ...page,
      page: await Promise.all(page.page.filter(tenant => tenant.deletedAt === undefined).map(tenant => toPlatformTenant(ctx, tenant))),
    };
  },
});

/** Cursor-paged lightweight tenant options for platform intake forms. */
export const listPlatformTenantTargetsPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const page = await ctx.db.query("tenants").withIndex("by_createdAt").order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(50, Math.floor(args.paginationOpts.numItems))),
    });
    return { ...page, page: page.page.filter(tenant => tenant.deletedAt === undefined).map(tenant => ({ _id: tenant._id, name: tenant.name })) };
  },
});

/** Paged subscription list with only fields needed for entitlement management. */
export const listSubscriptionsPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const page = await ctx.db.query("tenants").withIndex("by_createdAt").order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(50, Math.floor(args.paginationOpts.numItems))),
    });
    const tenants = page.page.filter(tenant => tenant.deletedAt === undefined);
    return {
      ...page,
      page: await Promise.all(tenants.map(async tenant => {
        const entitlement = await ctx.db.query("entitlements").withIndex("by_tenant", q => q.eq("tenantId", tenant._id)).order("desc").first();
        return {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          country: tenant.country,
          status: tenant.status,
          entitlement: entitlement ? {
            planId: entitlement.planId,
            status: entitlement.status,
            startsAt: entitlement.startsAt ?? null,
            expiresAt: entitlement.expiresAt ?? null,
            trialEndsAt: entitlement.trialEndsAt ?? null,
          } : null,
        };
      })),
    };
  },
});

/** Exact estate counters for overview without joining tenant members/markets/subscribers. */
export const getPlatformOverview = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const [tenantRows, entitlementRows] = await Promise.all([
      ctx.db.query("tenants").withIndex("by_createdAt").order("desc").collect(),
      ctx.db.query("entitlements").collect(),
    ]);
    const tenants = tenantRows.filter(tenant => tenant.deletedAt === undefined);
    const entitlements = new Map(entitlementRows.map(entitlement => [entitlement.tenantId, entitlement]));
    const latest = tenantRows.filter(tenant => tenant.deletedAt === undefined).slice(0, 8);
    const summary = {
      total: tenants.length,
      active: tenants.filter(tenant => tenant.status === "active").length,
      trial: tenants.filter(tenant => tenant.status === "trial").length,
      suspended: tenants.filter(tenant => tenant.status === "suspended").length,
      pendingDeletion: tenants.filter(tenant => tenant.status === "pending_deletion").length,
      missingIdentity: tenants.filter(tenant => !tenant.workosOrganizationId).length,
      entitlementRisk: tenants.filter(tenant => {
        const entitlement = entitlements.get(tenant._id);
        return entitlement?.status === "expired" || entitlement?.status === "suspended";
      }).length,
    };
    return {
      ...summary,
      latest: latest.map(tenant => {
        const entitlement = entitlements.get(tenant._id);
        return {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          country: tenant.country,
          status: tenant.status,
          workosOrganizationId: tenant.workosOrganizationId ?? null,
          entitlement: entitlement ? { planId: entitlement.planId, status: entitlement.status } : null,
        };
      }),
    };
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
    if (!tenant || tenant.deletedAt !== undefined) {
      return { status: "setup_required", reason: "tenant_unavailable" };
    }
    if (tenant.status === "suspended") {
      return { status: "setup_required", reason: "tenant_suspended" };
    }
    if (!canTenantOperate(tenant.status)) {
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
  args: { tenantId: v.id("tenants"), status: v.union(v.literal("active"), v.literal("suspended")) },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant not found");
    const transition = decideTenantLifecycleTransition(tenant.status, args.status, tenant.statusBeforeSuspension);
    if (!transition.changed) return { changed: false, status: tenant.status };
    await ctx.db.patch(tenant._id, {
      status: transition.status,
      statusBeforeSuspension: transition.statusBeforeSuspension,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "tenant.statusChanged",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before: { status: tenant.status },
      after: { status: transition.status, statusBeforeSuspension: transition.statusBeforeSuspension ?? null },
    });
    return { changed: true, status: transition.status };
  },
});

/** Begin the 30-day soft-delete window. Tenant access stops immediately. */
export const scheduleDeletion = mutation({
  args: { tenantId: v.id("tenants"), reason: v.string() },
  returns: v.object({ scheduledDeletionAt: v.number() }),
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant not found");
    if (!["trial", "active", "suspended"].includes(tenant.status)) throw new Error("This tenant cannot be scheduled for deletion in its current state");
    const reason = args.reason.trim();
    if (reason.length < 8 || reason.length > 500) throw new Error("Provide a reason between 8 and 500 characters");
    const now = Date.now();
    const scheduledDeletionAt = now + TENANT_DELETION_GRACE_PERIOD_MS;
    await ctx.db.patch(tenant._id, {
      statusBeforeDeletion: tenant.status as "trial" | "active" | "suspended",
      status: "pending_deletion",
      deletionRequestedAt: now,
      scheduledDeletionAt,
      deletionRequestedBy: actor._id,
      deletionReason: reason,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "tenant.deletionScheduled",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before: { status: tenant.status },
      after: { status: "pending_deletion", scheduledDeletionAt, reason },
    });
    return { scheduledDeletionAt };
  },
});

/** Restore a tenant during its 30-day recovery window. */
export const restoreScheduledDeletion = mutation({
  args: { tenantId: v.id("tenants") },
  returns: v.object({ restored: v.boolean(), status: v.union(v.literal("trial"), v.literal("active"), v.literal("suspended")) }),
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined || tenant.status !== "pending_deletion" || tenant.scheduledDeletionAt === undefined) {
      throw new Error("Tenant is not awaiting deletion");
    }
    if (Date.now() >= tenant.scheduledDeletionAt) throw new Error("The tenant recovery window has ended");
    const restoredStatus = tenant.statusBeforeDeletion ?? "active";
    await ctx.db.patch(tenant._id, {
      status: restoredStatus,
      statusBeforeDeletion: undefined,
      deletionRequestedAt: undefined,
      scheduledDeletionAt: undefined,
      deletionRequestedBy: undefined,
      deletionReason: undefined,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "tenant.deletionCancelled",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before: { status: tenant.status, scheduledDeletionAt: tenant.scheduledDeletionAt },
      after: { status: restoredStatus },
    });
    return { restored: true, status: restoredStatus };
  },
});

/**
 * Finalize expired tenant deletion requests in bounded batches. This hides the
 * tenant from the active directory and blocks access, while retaining the
 * tenant-owned records for the approved data-retention workflow.
 */
export const finalizeExpiredDeletions = internalMutation({
  args: {},
  returns: v.object({ finalized: v.number() }),
  handler: async (ctx) => {
    const now = Date.now();
    const due = await ctx.db.query("tenants")
      .withIndex("by_status_and_scheduled_deletion", q => q.eq("status", "pending_deletion").lte("scheduledDeletionAt", now))
      .take(100);
    for (const tenant of due) {
      await ctx.db.patch(tenant._id, { status: "cancelled", deletedAt: now, updatedAt: now });
      if (tenant.deletionRequestedBy) {
        await logAudit(ctx, {
          action: "tenant.deletionWindowElapsed",
          entityTable: "tenants",
          entityId: tenant._id,
          changedBy: tenant.deletionRequestedBy,
          before: { status: "pending_deletion", scheduledDeletionAt: tenant.scheduledDeletionAt },
          after: { status: "cancelled", deletedAt: now, retainedForDataRequest: true },
        });
      }
    }
    return { finalized: due.length };
  },
});

/** Update editable tenant profile fields without changing its identity or lifecycle. */
export const updateTenant = mutation({
  args: {
    tenantId: v.id("tenants"),
    name: v.string(),
    country: v.string(),
    timezone: v.string(),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant not found");
    const name = args.name.trim();
    const country = args.country.trim().toUpperCase();
    const timezone = args.timezone.trim();
    const currency = args.currency.trim().toUpperCase();
    if (!name || name.length > 120) throw new Error("Tenant name must be 1–120 characters");
    if (!/^[A-Z]{2}$/.test(country)) throw new Error("Country must be a two-letter ISO country code");
    if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO currency code");
    try {
      new Intl.DateTimeFormat("en", { timeZone: timezone });
    } catch {
      throw new Error("Timezone must be a valid IANA timezone");
    }
    const before = { name: tenant.name, country: tenant.country, timezone: tenant.timezone, currency: tenant.currency };
    const after = { name, country, timezone, currency };
    await ctx.db.patch(tenant._id, { ...after, updatedAt: Date.now() });
    await logAudit(ctx, {
      action: "tenant.profileUpdated",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before,
      after,
    });
    return { updated: true };
  },
});

/** Platform-side tenant detail: identity mapping, entitlement, and member roster. Returns null for missing/deleted tenants so the client can show a proper empty state. */
export const getTenantDetail = query({
  args: { tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) return null;
    const [memberships, entitlement, markets] = await Promise.all([
      ctx.db
        .query("tenantMemberships")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .collect(),
      ctx.db
        .query("entitlements")
        .withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId))
        .order("desc")
        .first(),
      ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId)).collect(),
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
      statusBeforeSuspension: tenant.statusBeforeSuspension ?? null,
      scheduledDeletionAt: tenant.scheduledDeletionAt ?? null,
      deletionReason: tenant.deletionReason ?? null,
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
      marketCount: markets.filter((market) => market.status !== "deleted").length,
      subscriberCount: tenant.subscriberCount ?? null,
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
    startsAt: v.optional(v.union(v.number(), v.null())),
    expiresAt: v.optional(v.union(v.number(), v.null())),
    trialEndsAt: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant not found");
    const planId = args.planId.trim().toLowerCase();
    if (!/^[a-z][a-z0-9_-]{1,39}$/.test(planId)) throw new Error("Select a valid subscription plan");
    for (const [label, value] of [["startsAt", args.startsAt], ["expiresAt", args.expiresAt], ["trialEndsAt", args.trialEndsAt]] as const) {
      if (typeof value === "number" && (!Number.isSafeInteger(value) || value < 0)) throw new Error(`${label} must be a valid timestamp`);
    }
    const tenantEntitlements = await ctx.db.query("entitlements").withIndex("by_tenant", q => q.eq("tenantId", args.tenantId)).order("desc").take(2);
    if (tenantEntitlements.length > 1) {
      throw new Error("This tenant has multiple entitlement records. Reconcile the subscription records before changing its plan.");
    }
    const existingForTenant = tenantEntitlements[0];
    const startsAt = args.startsAt === undefined ? existingForTenant?.startsAt : args.startsAt ?? undefined;
    const expiresAt = args.expiresAt === undefined ? existingForTenant?.expiresAt : args.expiresAt ?? undefined;
    const trialEndsAt = args.trialEndsAt === undefined ? existingForTenant?.trialEndsAt : args.trialEndsAt ?? undefined;
    if (startsAt !== undefined && expiresAt !== undefined && expiresAt < startsAt) throw new Error("Expiry must be after the subscription start");
    if (startsAt !== undefined && trialEndsAt !== undefined && trialEndsAt < startsAt) throw new Error("Trial end must be after the subscription start");
    const plan = await ctx.db.query("platformPlanCatalog").withIndex("by_code", q => q.eq("code", planId)).first();
    if (plan?.status === "archived" && existingForTenant?.planId !== planId) throw new Error("Archived plans cannot be assigned to new subscriptions");
    // The baked-in plans are a migration fallback only. Once the catalogue has
    // been initialized, an intentionally deleted plan must not remain assignable.
    const catalogInitialized = await ctx.db.query("platformPlanCatalogMeta").first();
    if (!plan && (catalogInitialized || !["starter", "growth", "pro"].includes(planId))) {
      throw new Error("Choose an active plan from the platform plan catalogue");
    }

    const auditAfter = {
      planId,
      status: args.status,
      startsAt: startsAt ?? null,
      expiresAt: expiresAt ?? null,
      trialEndsAt: trialEndsAt ?? null,
    };
    const existing = existingForTenant;
    const now = Date.now();

    if (existing) {
      const before = {
        planId: existing.planId,
        status: existing.status,
        startsAt: existing.startsAt ?? null,
        expiresAt: existing.expiresAt ?? null,
        trialEndsAt: existing.trialEndsAt ?? null,
      };
      const patch: Record<string, unknown> = { planId, status: args.status, updatedAt: now };
      if (args.startsAt !== undefined) patch.startsAt = startsAt;
      if (args.expiresAt !== undefined) patch.expiresAt = expiresAt;
      if (args.trialEndsAt !== undefined) patch.trialEndsAt = trialEndsAt;
      await ctx.db.patch(existing._id, patch);
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

    await ctx.db.insert("entitlements", {
      tenantId: tenant._id,
      planId,
      status: args.status,
      ...(startsAt !== undefined ? { startsAt } : {}),
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(trialEndsAt !== undefined ? { trialEndsAt } : {}),
      createdAt: now,
      updatedAt: now,
    });
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

/** Remove a tenant's current product entitlement. Invoices and payment data are not affected. */
export const removeEntitlement = mutation({
  args: { tenantId: v.id("tenants"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant not found");
    const reason = args.reason.trim();
    if (reason.length < 8 || reason.length > 500) throw new Error("Provide a reason between 8 and 500 characters");
    const records = await ctx.db.query("entitlements").withIndex("by_tenant", q => q.eq("tenantId", args.tenantId)).order("desc").take(2);
    if (records.length > 1) {
      throw new Error("This tenant has multiple entitlement records. Reconcile the subscription records before removing an entitlement.");
    }
    if (records.length === 0) return { removed: false };
    const [record] = records;
    await ctx.db.delete(record._id);
    await logAudit(ctx, {
      action: "tenant.entitlementRemoved",
      entityTable: "tenants",
      entityId: tenant._id,
      changedBy: actor._id,
      before: { planId: record.planId, status: record.status, startsAt: record.startsAt ?? null, expiresAt: record.expiresAt ?? null, trialEndsAt: record.trialEndsAt ?? null },
      after: { entitlementCount: 0, reason },
    });
    return { removed: true };
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

    const publicSignupSessions = await ctx.db
      .query("signupSessions")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .collect();
    const activePublicSignup = publicSignupSessions.find(
      (session) => session.tenantId === undefined && session.expiresAt > Date.now(),
    );
    if (activePublicSignup) {
      throw new Error("This workspace address is currently being set up");
    }

    const existing = await ctx.db
      .query("tenantOnboardingRuns")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .order("desc")
      .first();
    if (existing) {
      return {
        runId: existing._id,
        workosOrganizationId: existing.workosOrganizationId,
        workosUserId: existing.workosUserId,
        workosMembershipId: existing.workosMembershipId,
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
    return {
      runId,
      workosOrganizationId: undefined,
      workosUserId: undefined,
      workosMembershipId: undefined,
      workosInvitationId: undefined,
      tenantId: undefined,
    };
  },
});

/** Persist non-secret provider delivery references so a retry does not recreate the workspace. */
export const recordAutomatedTenantIdentity = internalMutation({
  args: {
    runId: v.id("tenantOnboardingRuns"),
    workosOrganizationId: v.optional(v.string()),
    workosUserId: v.optional(v.string()),
    workosMembershipId: v.optional(v.string()),
    workosInvitationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Tenant onboarding run not found");
    if (run.tenantId) return;
    await ctx.db.patch(run._id, {
      workosOrganizationId: args.workosOrganizationId ?? run.workosOrganizationId,
      workosUserId: args.workosUserId ?? run.workosUserId,
      workosMembershipId: args.workosMembershipId ?? run.workosMembershipId,
      workosInvitationId: args.workosInvitationId ?? run.workosInvitationId,
      updatedAt: Date.now(),
    });
  },
});

/** Turn a fully prepared background run into a tenant with a ready owner grant. */
export const finalizeAutomatedTenantOnboarding = internalMutation({
  args: { runId: v.id("tenantOnboardingRuns") },
  handler: async (ctx, args) => {
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Tenant onboarding run not found");
    if (!run.workosOrganizationId || !run.workosUserId || !run.workosMembershipId) {
      throw new Error("Tenant onboarding has not completed administrator access setup");
    }
    const now = Date.now();
    let owner = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", run.workosUserId!))
      .first();
    if (!owner) {
      const ownerId = await ctx.db.insert("users", {
        workosUserId: run.workosUserId,
        email: run.ownerEmail,
        name: run.ownerName,
        isActive: true,
      });
      owner = await ctx.db.get(ownerId);
    }
    if (!owner || owner.deletedAt !== undefined || owner.isActive === false) {
      throw new Error("Tenant administrator account is unavailable");
    }
    if (run.tenantId) {
      const existingMembership = await ctx.db
        .query("tenantMemberships")
        .withIndex("by_user_tenant", (q) => q.eq("userId", owner!._id).eq("tenantId", run.tenantId!))
        .first();
      if (existingMembership) {
        await ctx.db.patch(existingMembership._id, {
          role: "tenant_admin", status: "active", workosMembershipId: run.workosMembershipId,
          joinedAt: existingMembership.joinedAt ?? now, revokedAt: undefined,
        });
      } else {
        await ctx.db.insert("tenantMemberships", {
          userId: owner._id, tenantId: run.tenantId, role: "tenant_admin", status: "active",
          workosMembershipId: run.workosMembershipId, joinedAt: now,
        });
      }
      const existingTenant = await ctx.db.get(run.tenantId);
      if (existingTenant?.status === "provisioning") {
        await ctx.db.patch(existingTenant._id, { status: "trial", updatedAt: now });
      }
      await ctx.db.patch(run._id, { state: "completed", updatedAt: now });
      return { tenantId: run.tenantId };
    }
    const [bySlug, byOrganization] = await Promise.all([
      ctx.db.query("tenants").withIndex("by_slug", (q) => q.eq("slug", run.slug)).first(),
      ctx.db.query("tenants").withIndex("by_workosOrganizationId", (q) => q.eq("workosOrganizationId", run.workosOrganizationId!)).first(),
    ]);
    if (bySlug || byOrganization) throw new Error("A tenant already uses this workspace identity");
    const tenantId = await ctx.db.insert("tenants", {
      name: run.name,
      slug: run.slug,
      country: run.country,
      timezone: run.timezone,
      currency: run.currency,
      status: "trial",
      subscriberCount: 0,
      workosOrganizationId: run.workosOrganizationId,
      createdAt: now,
      updatedAt: now,
    });
    await ctx.db.insert("tenantMemberships", {
      userId: owner._id,
      tenantId,
      role: "tenant_admin",
      status: "active",
      workosMembershipId: run.workosMembershipId,
      joinedAt: now,
    });
    await ctx.db.patch(run._id, { tenantId, state: "completed", updatedAt: now });
    await logAudit(ctx, {
      action: "tenant.onboardingCompleted",
      entityTable: "tenants",
      entityId: tenantId,
      changedBy: run.createdBy,
      after: { status: "trial", ownerEmail: run.ownerEmail, ownerReady: true },
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
 * details only; provider identifiers and membership setup remain backend-only.
 */
export const provisionTenant = action({
  args: {
    name: v.string(), slug: v.string(), country: v.string(), timezone: v.string(), currency: v.string(),
    ownerEmail: v.string(), ownerName: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<
    | { tenantId: Id<"tenants">; status: "ready" }
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
      if (run.tenantId) return { tenantId: run.tenantId, status: "ready" };
      const externalId = tenantOrganizationExternalId(onboarding.slug);
      let organization: { id: string };
      if (run.workosOrganizationId) {
        organization = { id: run.workosOrganizationId };
      } else {
        // Never adopt an unrecorded provider organization. It may have been
        // created by the public wizard or a historical onboarding attempt;
        // associating it here could give the wrong administrator access.
        const existingOrganization = await getWorkosOrganizationByExternalId(externalId);
        if (existingOrganization) throw new Error("Workspace identity already exists");
        organization = await createWorkosOrganization(onboarding.name, externalId);
      }
      await ctx.runMutation(internal.tenantControl.recordAutomatedTenantIdentity, {
        runId: run.runId, workosOrganizationId: organization.id,
      });
      const ownerWorkosUserId = run.workosUserId ?? await createWorkosUser(onboarding.ownerEmail);
      const existingMembership = await getWorkosOrganizationMembership(organization.id, ownerWorkosUserId);
      if (existingMembership && existingMembership.status.toLowerCase() !== "active") {
        throw new Error("Tenant administrator has an unresolved organization membership");
      }
      const membership = existingMembership ?? await addWorkosOrganizationMembership(
        organization.id,
        ownerWorkosUserId,
        "tenant_admin",
      );
      if (membership.status.toLowerCase() !== "active") {
        throw new Error("Tenant administrator membership is not active");
      }
      await ctx.runMutation(internal.tenantControl.recordAutomatedTenantIdentity, {
        runId: run.runId,
        workosUserId: ownerWorkosUserId,
        workosMembershipId: membership.id,
      });
      // Direct membership is intentional: tenant owners can sign in right
      // away with their existing identity. Credentials remain in WorkOS.
      const result = await ctx.runMutation(internal.tenantControl.finalizeAutomatedTenantOnboarding, { runId: run.runId });
      return { tenantId: result.tenantId, status: "ready" };
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
      subscriberCount: 0,
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
