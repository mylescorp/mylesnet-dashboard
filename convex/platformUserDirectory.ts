import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { action, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { logAudit } from "./lib/auditLog";
import { requirePlatformUser, resolveRoles } from "./lib/auth";
import { canTenantOperate } from "./lib/tenantCore";
import { deactivateOrganizationMembership, reactivateOrganizationMembership, sendWorkosPasswordReset } from "./workos";

const membershipStatusValidator = v.union(v.literal("active"), v.literal("revoked"));
const membershipReadValidator = v.object({
  tenantId: v.id("tenants"),
  tenantName: v.string(),
  role: v.string(),
  status: v.union(v.literal("active"), v.literal("pending"), v.literal("revoked")),
  syncPending: v.boolean(),
});
const directoryUserValidator = v.object({
  _id: v.id("users"),
  name: v.union(v.string(), v.null()),
  email: v.union(v.string(), v.null()),
  phone: v.union(v.string(), v.null()),
  status: v.union(v.literal("active"), v.literal("disabled"), v.literal("removed")),
  platformRoles: v.array(v.string()),
  tenantMemberships: v.array(membershipReadValidator),
  hasMoreTenantMemberships: v.boolean(),
});
const directoryPageValidator = v.object({
  items: v.array(directoryUserValidator),
  continueCursor: v.union(v.string(), v.null()),
  isDone: v.boolean(),
});
const authMembershipResultValidator = v.object({
  requestId: v.string(),
  actorUserId: v.id("users"),
  targetUserId: v.id("users"),
  workosUserId: v.string(),
  organizationId: v.string(),
  expectedStatus: v.union(v.literal("active"), v.literal("pending"), v.literal("revoked")),
  alreadyApplied: v.boolean(),
});
const resetAuthorizationValidator = v.object({
  actorUserId: v.id("users"),
  targetUserId: v.id("users"),
  email: v.string(),
});

type MembershipActionArgs = { userId: Id<"users">; tenantId: Id<"tenants">; status: "active" | "revoked"; requestId: string };

async function authorizeDirectoryActor(ctx: Parameters<typeof requirePlatformUser>[0]) {
  const actor = await requirePlatformUser(ctx);
  const roles = await resolveRoles(ctx, actor);
  const isSuperAdmin = roles.some((role) => role.slug === "platform_super_admin" || role.slug === "platform_owner" || role.slug === "platform_admin");
  const isSupport = roles.some((role) => role.slug === "platform_support");
  if (!isSuperAdmin && !isSupport) throw new Error("Unauthorized: directory access is restricted");
  return { actor, isSuperAdmin, isSupport };
}

async function authorizeMembershipAction(ctx: Parameters<typeof requirePlatformUser>[0], args: MembershipActionArgs) {
  const { actor, isSuperAdmin, isSupport } = await authorizeDirectoryActor(ctx);
  if (!/^[0-9a-f-]{36}$/i.test(args.requestId)) throw new Error("Access change request is invalid");
  const completed = await ctx.db.query("platformUserAccessRequests").withIndex("by_requestId", q => q.eq("requestId", args.requestId)).first();
  if (completed) {
    if (completed.actorUserId !== actor._id || completed.targetUserId !== args.userId || completed.tenantId !== args.tenantId || completed.status !== args.status) {
      throw new Error("Access change request identifier has already been used");
    }
    return {
      requestId: args.requestId, actorUserId: actor._id, targetUserId: args.userId,
      workosUserId: completed.workosUserId, organizationId: completed.organizationId,
      expectedStatus: args.status, alreadyApplied: true,
    };
  }
  if (args.status === "active" && !isSuperAdmin) throw new Error("Unauthorized: only a platform super-admin can restore access");
  const target = await ctx.db.get(args.userId);
  if (!target || target.deletedAt !== undefined || !target.workosUserId) throw new Error("User account not found");
  if (target._id === actor._id) throw new Error("You cannot change your own account access");
  const targetRoles = await resolveRoles(ctx, target);
  if (targetRoles.some((role) => role.slug === "platform_owner" || role.slug === "platform_super_admin")) {
    throw new Error("The platform owner account is protected");
  }
  if (isSupport && targetRoles.some((role) => role.isPlatform)) {
    throw new Error("Support can only manage end-tenant user access");
  }
  const membership = await ctx.db.query("tenantMemberships")
    .withIndex("by_user_tenant", (q) => q.eq("userId", target._id).eq("tenantId", args.tenantId))
    .first();
  const expectedStatus = args.status === "revoked" ? "active" : "revoked";
  if (!membership || (membership.status !== expectedStatus && membership.status !== args.status)) throw new Error("Workspace membership has changed; refresh and review it");
  const tenant = await ctx.db.get(args.tenantId);
  if (!tenant?.workosOrganizationId) throw new Error("Workspace access is not connected");
  if (args.status === "active" && !canTenantOperate(tenant.status)) throw new Error("This workspace is not active");
  return {
    actorUserId: actor._id,
    requestId: args.requestId,
    targetUserId: target._id,
    workosUserId: target.workosUserId,
    organizationId: tenant.workosOrganizationId,
    expectedStatus: membership.status,
    alreadyApplied: false,
  };
}

async function authorizePasswordReset(ctx: Parameters<typeof requirePlatformUser>[0], userId: Id<"users">) {
  const { actor, isSuperAdmin, isSupport } = await authorizeDirectoryActor(ctx);
  const target = await ctx.db.get(userId);
  if (!target || target.deletedAt !== undefined || !target.email || !target.workosUserId) throw new Error("User account is not available for password reset");
  if (target._id === actor._id) throw new Error("Use account settings to reset your own password");
  const targetRoles = await resolveRoles(ctx, target);
  if (targetRoles.some((role) => role.slug === "platform_owner" || role.slug === "platform_super_admin")) {
    throw new Error("The platform owner account is protected");
  }
  if (isSupport) {
    if (targetRoles.some((role) => role.isPlatform)) throw new Error("Support can only reset end-tenant user accounts");
    const tenantMembership = await ctx.db.query("tenantMemberships").withIndex("by_user", (q) => q.eq("userId", target._id)).first();
    if (!tenantMembership) throw new Error("Support can only reset end-tenant user accounts");
  }
  if (!isSuperAdmin && !isSupport) throw new Error("Unauthorized");
  return { actorUserId: actor._id, targetUserId: target._id, email: target.email };
}

export const list = query({
  args: {
    paginationOpts: paginationOptsValidator,
    email: v.optional(v.string()),
  },
  returns: directoryPageValidator,
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    let pageUsers;
    let continueCursor: string | null = null;
    let isDone = true;
    if (args.email !== undefined) {
      const email = args.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address");
      const user = await ctx.db.query("users").withIndex("email", (q) => q.eq("email", email)).first();
      pageUsers = user ? [user] : [];
    } else {
      const page = await ctx.db.query("users").order("desc").paginate({
        ...args.paginationOpts,
        numItems: Math.max(1, Math.min(args.paginationOpts.numItems, 50)),
      });
      pageUsers = page.page;
      continueCursor = page.isDone ? null : page.continueCursor;
      isDone = page.isDone;
    }
    const items = await Promise.all(pageUsers.map(async (user) => {
      const [roles, memberships] = await Promise.all([
        resolveRoles(ctx, user),
        ctx.db.query("tenantMemberships").withIndex("by_user", (q) => q.eq("userId", user._id)).take(51),
      ]);
      const tenantMemberships = (await Promise.all(memberships.map(async (membership) => {
        const tenant = await ctx.db.get(membership.tenantId);
        if (!tenant) return null;
        const pendingSync = await ctx.db.query("platformUserAccessRequests")
          .withIndex("by_target_tenant_created", q => q.eq("targetUserId", user._id).eq("tenantId", membership.tenantId))
          .order("desc").first();
        return {
          tenantId: tenant._id,
          tenantName: tenant.name,
          role: membership.role,
          status: membership.accessOverride ?? membership.status,
          syncPending: pendingSync?.syncStatus === "pending",
        };
      }))).filter((membership): membership is NonNullable<typeof membership> => membership !== null);
      return {
        _id: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
        phone: user.phone ?? null,
        status: user.deletedAt !== undefined ? "removed" as const : user.isActive === false || user.deactivatedAt !== undefined ? "disabled" as const : "active" as const,
        platformRoles: roles.filter((role) => role.isPlatform).map((role) => role.name),
        tenantMemberships: tenantMemberships.slice(0, 50),
        hasMoreTenantMemberships: tenantMemberships.length > 50,
      };
    }));
    return { items, continueCursor, isDone };
  },
});

export const authorizeMembershipChange = internalQuery({
  args: { userId: v.id("users"), tenantId: v.id("tenants"), status: membershipStatusValidator, requestId: v.string() },
  returns: authMembershipResultValidator,
  handler: (ctx, args) => authorizeMembershipAction(ctx, args),
});

export const updateMembership = action({
  args: { userId: v.id("users"), tenantId: v.id("tenants"), status: membershipStatusValidator, requestId: v.string() },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const authorized = await ctx.runQuery(internal.platformUserDirectory.authorizeMembershipChange, args);
    if (!authorized.alreadyApplied) {
      await ctx.runMutation(internal.platformUserDirectory.applyMembershipStatus, {
        userId: args.userId,
        tenantId: args.tenantId,
        status: args.status,
        expectedStatus: authorized.expectedStatus,
        actorUserId: authorized.actorUserId,
        requestId: authorized.requestId,
      });
    }
    // Local intent is persisted before the provider call. If another request
    // races while it is in flight, reconcile the provider to the latest local
    // state after every call instead of finishing with an obsolete command.
    try {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const desired = await ctx.runQuery(internal.platformUserDirectory.getDesiredMembershipAccess, { userId: args.userId, tenantId: args.tenantId });
        if (desired.status === "revoked") await deactivateOrganizationMembership(desired.organizationId, desired.workosUserId);
        else await reactivateOrganizationMembership(desired.organizationId, desired.workosUserId);
        const latest = await ctx.runQuery(internal.platformUserDirectory.getDesiredMembershipAccess, { userId: args.userId, tenantId: args.tenantId });
        if (latest.status === desired.status) {
          await ctx.runMutation(internal.platformUserDirectory.recordMembershipSync, { requestId: authorized.requestId, appliedStatus: desired.status, succeeded: true });
          return { updated: true };
        }
      }
      throw new Error("Workspace access changed repeatedly; retry after refreshing the directory");
    } catch {
      await ctx.runMutation(internal.platformUserDirectory.recordMembershipSync, { requestId: authorized.requestId, appliedStatus: args.status, succeeded: false });
      throw new Error("Workspace access could not be synchronized. The requested change is saved and will retry.");
    }
  },
});

export const getDesiredMembershipAccess = internalQuery({
  args: { userId: v.id("users"), tenantId: v.id("tenants") },
  returns: v.object({ organizationId: v.string(), workosUserId: v.string(), status: v.union(v.literal("active"), v.literal("revoked")) }),
  handler: async (ctx, args) => {
    const tenant = await ctx.db.get(args.tenantId);
    const user = await ctx.db.get(args.userId);
    const membership = await ctx.db.query("tenantMemberships").withIndex("by_user_tenant", q => q.eq("userId", args.userId).eq("tenantId", args.tenantId)).first();
    if (!tenant?.workosOrganizationId || !user?.workosUserId || !membership || (membership.status !== "active" && membership.status !== "revoked")) throw new Error("Workspace access state is unavailable");
    return { organizationId: tenant.workosOrganizationId, workosUserId: user.workosUserId, status: membership.accessOverride ?? membership.status };
  },
});

export const recordMembershipSync = internalMutation({
  args: { requestId: v.string(), appliedStatus: membershipStatusValidator, succeeded: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const request = await ctx.db.query("platformUserAccessRequests").withIndex("by_requestId", q => q.eq("requestId", args.requestId)).first();
    if (!request || request.syncStatus !== "pending") return null;
    if (args.succeeded && request.status === args.appliedStatus) {
      const membership = await ctx.db.query("tenantMemberships")
        .withIndex("by_user_tenant", q => q.eq("userId", request.targetUserId).eq("tenantId", request.tenantId)).first();
      if (membership?.accessOverride === request.status) {
        await ctx.db.patch(membership._id, { accessOverride: undefined, accessOverrideUpdatedAt: undefined });
      }
    }
    await ctx.db.patch(request._id, {
      syncStatus: args.succeeded ? (request.status === args.appliedStatus ? "synced" : "superseded") : "pending",
      syncAttempts: (request.syncAttempts ?? 0) + 1,
      lastSyncAttemptAt: Date.now(),
      nextSyncAttemptAt: Date.now() + 5 * 60 * 1000,
    });
    return null;
  },
});

export const listPendingMembershipSyncs = internalQuery({
  args: {},
  returns: v.array(v.object({ requestId: v.string(), userId: v.id("users"), tenantId: v.id("tenants"), status: membershipStatusValidator })),
  handler: async (ctx) => (await ctx.db.query("platformUserAccessRequests")
    .withIndex("by_sync_status_next_attempt", q => q.eq("syncStatus", "pending").lte("nextSyncAttemptAt", Date.now()))
    .order("asc").take(25))
    .map(request => ({ requestId: request.requestId, userId: request.targetUserId, tenantId: request.tenantId, status: request.status })),
});

export const applyMembershipStatus = internalMutation({
  args: {
    userId: v.id("users"), tenantId: v.id("tenants"), status: membershipStatusValidator, requestId: v.string(),
    expectedStatus: v.union(v.literal("active"), v.literal("pending"), v.literal("revoked")),
    actorUserId: v.id("users"),
  },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const { actor, isSuperAdmin, isSupport } = await authorizeDirectoryActor(ctx);
    if (actor._id !== args.actorUserId) throw new Error("Unauthorized");
    if (args.status === "active" && !isSuperAdmin) throw new Error("Unauthorized: only a platform super-admin can restore access");
    const target = await ctx.db.get(args.userId);
    if (!target || target.deletedAt !== undefined || !target.workosUserId) throw new Error("User account not found");
    if (target._id === actor._id) throw new Error("You cannot change your own account access");
    const targetRoles = await resolveRoles(ctx, target);
    if (targetRoles.some((role) => role.slug === "platform_owner" || role.slug === "platform_super_admin")) throw new Error("The platform owner account is protected");
    if (isSupport && targetRoles.some((role) => role.isPlatform)) throw new Error("Support can only manage end-tenant user access");
    const completed = await ctx.db.query("platformUserAccessRequests").withIndex("by_requestId", q => q.eq("requestId", args.requestId)).first();
    if (completed) {
      if (completed.actorUserId !== args.actorUserId || completed.targetUserId !== args.userId || completed.tenantId !== args.tenantId || completed.status !== args.status) throw new Error("Access change request identifier has already been used");
    }
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant?.workosOrganizationId || (args.status === "active" && !canTenantOperate(tenant.status))) throw new Error("Workspace access is not available");
    const membership = await ctx.db.query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", args.userId).eq("tenantId", args.tenantId))
      .first();
    if (!membership) throw new Error("Workspace membership not found");
    if (membership.status !== args.status && membership.status !== args.expectedStatus) throw new Error("Workspace membership has changed; refresh and review it");
    if (membership.status !== args.status || membership.accessOverride !== args.status) {
      await ctx.db.patch(membership._id, {
        status: args.status,
        accessOverride: args.status,
        accessOverrideUpdatedAt: Date.now(),
        revokedAt: args.status === "revoked" ? Date.now() : undefined,
      });
    }
    if (!completed) await logAudit(ctx, {
      action: args.status === "revoked" ? "global_user.tenant_access_disabled" : "global_user.tenant_access_restored",
      entityTable: "users",
      entityId: args.userId,
      changedBy: args.actorUserId,
      before: { tenantId: args.tenantId, status: args.expectedStatus },
      after: { tenantId: args.tenantId, status: args.status, requestId: args.requestId, alreadyEffective: membership.status === args.status },
    });
    if (!completed) await ctx.db.insert("platformUserAccessRequests", {
      requestId: args.requestId, actorUserId: args.actorUserId, targetUserId: args.userId,
      tenantId: args.tenantId, status: args.status, organizationId: tenant.workosOrganizationId,
      workosUserId: target.workosUserId, syncStatus: "pending", syncAttempts: 0, nextSyncAttemptAt: Date.now(), createdAt: Date.now(),
    });
    return { updated: true };
  },
});

export const authorizePasswordResetRequest = internalQuery({
  args: { userId: v.id("users") },
  returns: resetAuthorizationValidator,
  handler: (ctx, args) => authorizePasswordReset(ctx, args.userId),
});

export const sendPasswordReset = action({
  args: { userId: v.id("users") },
  returns: v.object({ sent: v.boolean() }),
  handler: async (ctx, args) => {
    const authorized = await ctx.runQuery(internal.platformUserDirectory.authorizePasswordResetRequest, args);
    await sendWorkosPasswordReset(authorized.email);
    await ctx.runMutation(internal.platformUserDirectory.recordPasswordResetAudit, {
      userId: authorized.targetUserId,
      actorUserId: authorized.actorUserId,
    });
    return { sent: true };
  },
});

export const recordPasswordResetAudit = internalMutation({
  args: { userId: v.id("users"), actorUserId: v.id("users") },
  returns: v.object({ recorded: v.boolean() }),
  handler: async (ctx, args) => {
    const authorized = await authorizePasswordReset(ctx, args.userId);
    if (authorized.actorUserId !== args.actorUserId) throw new Error("Unauthorized");
    await logAudit(ctx, {
      action: "global_user.password_reset_requested",
      entityTable: "users",
      entityId: args.userId,
      changedBy: args.actorUserId,
      after: { resetEmailSent: true },
    });
    return { recorded: true };
  },
});
