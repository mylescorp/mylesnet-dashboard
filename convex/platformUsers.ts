import { v } from "convex/values";
import { z } from "zod";
import { action, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { Id } from "./_generated/dataModel";
import { requirePermission, resolveRoles, resolveUserByIdentity } from "./lib/auth";
import { workosSlugForRole } from "./lib/permissions";
import {
  addWorkosOrganizationMembership,
  createWorkosUser,
  deactivateWorkosMembership,
  getWorkosUserByEmail,
  platformOrganizationIdForRoleSync,
  reactivateWorkosMembership,
  setWorkosUserRole,
} from "./workos";

const marketMembershipRoleValidator = v.union(
  v.literal("manager"),
  v.literal("operator"),
  v.literal("viewer"),
);

const profileSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  phone: z.string().trim().regex(/^\+[1-9]\d{7,14}$/).optional(),
  jobTitle: z.string().trim().max(100).optional(),
});

/**
 * Public mutation allowing signed-in users to update their profile name,
 * phone number, and job title.
 */
export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) throw new Error("Unauthenticated");
    if (user.isActive === false || user.deactivatedAt !== undefined) {
      throw new Error("Unauthorized: account is inactive");
    }

    const normalizedInput = {
      ...args,
      phone: args.phone?.replace(/[\s()-]/g, ""),
      jobTitle: args.jobTitle?.trim() || undefined,
      name: args.name?.trim() || undefined,
    };
    const validated = profileSchema.safeParse(normalizedInput);
    if (!validated.success) throw new Error("Invalid profile details");

    const patchData: { name?: string; phone?: string; jobTitle?: string; profileCompletedAt?: number } = {};
    if (validated.data.name !== undefined) patchData.name = validated.data.name;
    if (validated.data.phone !== undefined) patchData.phone = validated.data.phone;
    if (validated.data.jobTitle !== undefined) patchData.jobTitle = validated.data.jobTitle;
    if (patchData.name && patchData.phone) patchData.profileCompletedAt = Date.now();

    await ctx.db.patch(user._id, patchData);

    await ctx.db.insert("auditLog", {
      action: "user.update_profile",
      entityTable: "users",
      entityId: user._id,
      changedBy: user._id,
      afterJson: JSON.stringify(patchData),
      timestamp: Date.now(),
    });

    return user._id;
  },
});

/** Return platform identities with their active roles and market scopes. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "users:read");
    const users = await ctx.db.query("users").take(500);
    const roleCache = new Map<string, { _id: string; slug: string; name: string; isPlatform: boolean; rank: number }>();
    for (const user of users) {
      for (const roleId of user.roles ?? []) {
        if (!roleCache.has(roleId)) {
          const role = await ctx.db.get(roleId);
          if (role && role.deletedAt === undefined) {
            roleCache.set(roleId, {
              _id: role._id,
              slug: role.slug,
              name: role.name,
              isPlatform: role.isPlatform,
              rank: role.rank,
            });
          }
        }
      }
    }
    return Promise.all(users.map(async (user) => {
      const resolvedRoles = (user.roles ?? [])
        .map((roleId) => roleCache.get(roleId))
        .filter((role): role is NonNullable<typeof role> => role !== undefined)
        .sort((left, right) => right.rank - left.rank);
      const primary = resolvedRoles[0] ?? null;
      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        image: user.image,
        jobTitle: user.jobTitle,
        platformRole: user.platformRole ?? null,
        roles: resolvedRoles,
        primaryRole: primary ? { slug: primary.slug, name: primary.name, isPlatform: primary.isPlatform } : null,
        isActive: user.isActive !== false && user.deactivatedAt === undefined && user.deletedAt === undefined,
        deletedAt: user.deletedAt ?? null,
        deletedBy: user.deletedBy ?? null,
        marketMemberships: await ctx.db
          .query("userMarketMemberships")
          .withIndex("by_user", (q) => q.eq("userId", user._id))
          .collect(),
      };
    }));
  },
});

const accessArgs = {
  userId: v.id("users"),
  roleIds: v.optional(v.array(v.id("roles"))),
  isActive: v.boolean(),
  marketId: v.optional(v.id("markets")),
  marketRole: v.optional(marketMembershipRoleValidator),
  name: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
  phone: v.optional(v.string()),
};

/**
 * Owners and admins assign least-privilege local access. The primary (highest
 * rank) role is mirrored onto the WorkOS organization membership so JWTs stay
 * consistent; deactivation deactivates the WorkOS membership (revoking sessions).
 */
export const setUserAccess = action({
  args: accessArgs,
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const target = await ctx.runQuery(internal.platformUsers.getUserForAccessUpdate, { userId: args.userId });
    if (!target) throw new Error("User not found");
    if (!target.workosUserId) throw new Error("Target identity has not been synchronized");

    await ctx.runMutation(internal.platformUsers.applyUserAccess, {
      actorWorkosUserId: identity.subject,
      userId: args.userId,
      roleIds: args.roleIds ?? [],
      isActive: args.isActive,
      marketId: args.marketId,
      marketRole: args.marketRole,
      targetWorkosUserId: target.workosUserId,
    });

    // Mirror the primary role and lifecycle onto WorkOS membership.
    if (args.isActive) {
      await reactivateWorkosMembership(target.workosUserId);
      const roleIds = args.roleIds ?? [];
      if (roleIds.length > 0) {
        const roles = await ctx.runQuery(internal.platformUsers.getRolesByIds, { roleIds });
        const primary = roles.slice().sort(
          (left: { rank: number }, right: { rank: number }) => right.rank - left.rank
        )[0];
        if (primary?.workosRoleSlug) {
          await setWorkosUserRole(target.workosUserId, primary.workosRoleSlug);
        }
      }
    } else {
      await deactivateWorkosMembership(target.workosUserId);
    }
  },
});

export const getUserForAccessUpdate = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => ctx.db.get(args.userId),
});

export const getUserByEmail = internalQuery({
  args: { email: v.string() },
  handler: async (ctx, args) =>
    ctx.db.query("users").withIndex("email", (q) => q.eq("email", args.email.toLowerCase())).first(),
});

export const getRolesByIds = internalQuery({
  args: { roleIds: v.array(v.id("roles")) },
  handler: async (ctx, args) => {
    const rows = await Promise.all(args.roleIds.map((roleId) => ctx.db.get(roleId)));
    return rows.filter((row): row is NonNullable<typeof row> => row !== null && row.deletedAt === undefined);
  },
});

const PLATFORM_MIRROR_SLUGS = new Set(["platform_owner", "platform_admin", "platform_support", "agent"]);

export const applyUserAccess = internalMutation({
  args: {
    actorWorkosUserId: v.string(),
    targetWorkosUserId: v.string(),
    ...accessArgs,
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", args.actorWorkosUserId))
      .first();
    if (!actor || actor.isActive === false || actor.deactivatedAt !== undefined) {
      throw new Error("Unauthorized");
    }
    const actorRoles = await resolveRoles(ctx, actor);
    if (!actorRoles.some((role) => role.slug === "platform_owner" || role.slug === "platform_admin")) {
      throw new Error("Unauthorized: admin role required");
    }
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target.deletedAt !== undefined) throw new Error("This account is removed. Restore it before making changes.");
    if (target._id === actor._id && !args.isActive) throw new Error("You cannot deactivate your own account");

    const targetOwner = target.platformRole === "platform_owner" ||
      ((target.roles ?? []).length > 0 &&
        (await Promise.all((target.roles ?? []).map((r) => ctx.db.get(r))))
          .some((row) => row?.slug === "platform_owner"));
    if (targetOwner) throw new Error("The platform owner's access cannot be changed here.");

    const roleIds = args.roleIds ?? [];
    const roleRows = (await Promise.all(roleIds.map((roleId) => ctx.db.get(roleId))))
      .filter((row): row is NonNullable<typeof row> => row !== null && row.deletedAt === undefined);
    if (roleRows.some((row) => row.slug === "platform_owner")) {
      throw new Error("The owner role can only be assigned during bootstrap.");
    }
    const primary = roleRows.slice().sort(
      (left: { rank: number }, right: { rank: number }) => right.rank - left.rank
    )[0];
    const primarySlug = primary?.slug;

    await ctx.db.patch(target._id, {
      roles: roleRows.map((row) => row._id),
      platformRole: primarySlug && PLATFORM_MIRROR_SLUGS.has(primarySlug)
        ? (primarySlug as "platform_owner" | "platform_admin" | "platform_support" | "agent")
        : undefined,
      isActive: args.isActive,
      deactivatedAt: args.isActive ? undefined : Date.now(),
      name: args.name !== undefined ? args.name.trim() || target.name : target.name,
      jobTitle: args.jobTitle !== undefined ? args.jobTitle.trim() || undefined : target.jobTitle,
      phone: args.phone !== undefined ? args.phone.trim() || undefined : target.phone,
    });

    if (args.marketId && args.marketRole) {
      const existing = await ctx.db
        .query("userMarketMemberships")
        .withIndex("by_user_and_market", (q) => q.eq("userId", target._id).eq("marketId", args.marketId!))
        .first();
      if (existing) {
        await ctx.db.patch(existing._id, { role: args.marketRole, revokedAt: undefined, updatedAt: Date.now() });
      } else {
        await ctx.db.insert("userMarketMemberships", {
          userId: target._id,
          marketId: args.marketId,
          role: args.marketRole,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
    await ctx.db.insert("auditLog", {
      action: "user.update_access",
      entityTable: "users",
      entityId: target._id,
      changedBy: actor._id,
      timestamp: Date.now(),
      afterJson: JSON.stringify({
        roleIds,
        primarySlug,
        isActive: args.isActive,
        marketId: args.marketId,
        marketRole: args.marketRole,
        name: args.name,
        jobTitle: args.jobTitle,
        phone: args.phone,
      }),
    });
  },
});

export const syncWorkosIdentity = internalMutation({
  args: {
    workosUserId: v.string(),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", args.workosUserId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email: args.email?.toLowerCase() ?? existing.email,
        name: args.name ?? existing.name,
        image: args.image ?? existing.image,
        isActive: existing.isActive ?? true,
      });
      return existing._id;
    }
    const byEmail = args.email
      ? await ctx.db.query("users").withIndex("email", (q) => q.eq("email", args.email!.toLowerCase())).first()
      : null;
    if (byEmail) {
      await ctx.db.patch(byEmail._id, { workosUserId: args.workosUserId, isActive: byEmail.isActive ?? true });
      return byEmail._id;
    }
    return ctx.db.insert("users", {
      workosUserId: args.workosUserId,
      email: args.email?.toLowerCase(),
      name: args.name,
      image: args.image,
      isActive: true,
    });
  },
});

export const assertNetworkOperator = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "routers:read");
    return user._id;
  },
});

/**
 * Atomic guard + write for setting the authenticated user's platformRole.
 *
 * Runs as an internal mutation so the one-shot owner guarantee is enforced
 * atomically: only the first caller can become platform_owner. System roles
 * are seeded first so the matching role registry row exists.
 *
 * Internal — the public entry point is `bootstrap:claimPlatformOwner`.
 */
export const setPlatformRole = internalMutation({
  args: {
    platformRole: v.union(
      v.literal("platform_owner"),
      v.literal("platform_admin"),
      v.literal("platform_support"),
      v.literal("agent")
    ),
  },
  handler: async (ctx, args) => {
    await ctx.runMutation(internal.rolesAdmin.seedLocalSystemRoles, {});
    const role = await ctx.db
      .query("roles")
      .withIndex("by_slug", (q) => q.eq("slug", args.platformRole))
      .first();
    const user = await resolveUserByIdentity(ctx);
    if (!user) throw new Error("Unauthenticated");

    if (args.platformRole === "platform_owner") {
      const existingOwner = await ctx.db
        .query("users")
        .withIndex("by_platformRole", (q) => q.eq("platformRole", "platform_owner"))
        .first();

      if (existingOwner) {
        if (existingOwner._id === user._id) {
          throw new Error("You are already the platform owner on record.");
        }
        throw new Error("A platform owner already exists. This bootstrap runs once only.");
      }
    }

    await ctx.db.patch(user._id, {
      platformRole: args.platformRole,
      roles: role ? [role._id] : user.roles,
    });
    return user._id;
  },
});

/** Returns the Convex users._id of the current platform owner, if any. */
export const getPlatformOwnerId = internalQuery({
  args: {},
  handler: async (ctx) => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_platformRole", (q) => q.eq("platformRole", "platform_owner"))
      .first();
    return owner?._id ?? null;
  },
});

/**
 * Webhook-driven membership cache sync (organization_membership.* events).
 * Upserts the membership row and reflects status onto the local user record.
 */
export const recordOrganizationMembership = internalMutation({
  args: {
    workosMembershipId: v.string(),
    workosUserId: v.string(),
    organizationId: v.string(),
    roleSlug: v.optional(v.string()),
    status: v.union(v.literal("active"), v.literal("inactive"), v.literal("pending")),
    email: v.optional(v.string()),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_membership", (q) => q.eq("workosMembershipId", args.workosMembershipId))
      .first();

    let roleId: Id<"roles"> | undefined;
    if (args.roleSlug) {
      const bySlug = await ctx.db.query("roles").withIndex("by_slug", (q) => q.eq("slug", args.roleSlug!)).first();
      if (bySlug && bySlug.deletedAt === undefined) {
        roleId = bySlug._id;
      } else {
        const custom = await ctx.db
          .query("roles")
          .filter((q) => q.eq(q.field("workosRoleSlug"), args.roleSlug!))
          .first();
        if (custom && custom.deletedAt === undefined) roleId = custom._id;
      }
    }

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        roleSlug: args.roleSlug,
        roleId,
        syncedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("organizationMemberships", {
        workosMembershipId: args.workosMembershipId,
        workosUserId: args.workosUserId,
        organizationId: args.organizationId,
        roleSlug: args.roleSlug,
        roleId,
        status: args.status,
        syncedAt: Date.now(),
      });
    }

    // Only manage the local user record for the configured platform org.
    const platformOrgId = process.env.MYLESNET_PLATFORM_ORG_ID;
    if (platformOrgId && args.organizationId === platformOrgId) {
      const userId = await ctx.db
        .query("users")
        .withIndex("by_workosUserId", (q) => q.eq("workosUserId", args.workosUserId))
        .first();

      // Removed accounts stay removed — membership events cannot re-activate them.
      if (userId && userId.deletedAt !== undefined) {
        if (args.status === "active") {
          await ctx.db.patch(userId._id, { isActive: false, deactivatedAt: Date.now() });
        }
      } else if (args.status === "active") {
        const patch: Record<string, unknown> = { isActive: true, deactivatedAt: undefined };
        if (roleId) patch.roles = [roleId];
        if (args.roleSlug && PLATFORM_MIRROR_SLUGS.has(args.roleSlug)) {
          patch.platformRole = args.roleSlug;
        }
        if (args.email !== undefined) patch.email = args.email.toLowerCase();
        if (args.name !== undefined) patch.name = args.name;
        if (userId) {
          await ctx.db.patch(userId._id, patch);
        } else {
          await ctx.db.insert("users", {
            workosUserId: args.workosUserId,
            email: args.email?.toLowerCase(),
            name: args.name,
            isActive: true,
            roles: roleId ? [roleId] : undefined,
          });
        }
      } else if (userId) {
        await ctx.db.patch(userId._id, { isActive: false, deactivatedAt: Date.now() });
      }
    }
  },
});

/* ------------------------------------------------------------------ */
/* User directory CRUD (create / soft-delete / restore)                */
/* ------------------------------------------------------------------ */

function normalizeEmail(email: string): string {
  const normalized = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) throw new Error("Enter a valid email address.");
  return normalized;
}

const profileEditArgs = {
  name: v.optional(v.string()),
  jobTitle: v.optional(v.string()),
  phone: v.optional(v.string()),
  marketId: v.optional(v.id("markets")),
  marketRole: v.optional(marketMembershipRoleValidator),
};

/**
 * Add a user to the directory: creates/finds their WorkOS identity,
 * grants an organization membership, and records the local user row with
 * the initially assigned roles and market scope.
 */
export const createUser = action({
  args: {
    email: v.string(),
    ...profileEditArgs,
    roleIds: v.optional(v.array(v.id("roles"))),
  },
  handler: async (ctx, args) => {
    const actor = (await ctx.runQuery(internal.rolesInternal.authorize, { permission: "users:manage" })) as {
      userId: Id<"users">;
      workosUserId: string | null;
    };

    const email = normalizeEmail(args.email);
    const existing = await ctx.runQuery(internal.platformUsers.getUserByEmail, { email });
    if (existing) throw new Error(`A user for ${email} already exists in the directory.`);

    let roleIds = args.roleIds ?? [];
    let roles = await ctx.runQuery(internal.platformUsers.getRolesByIds, { roleIds });
    // Every directory-created account gets an explicit baseline role. This is
    // required both for local authorization and the WorkOS membership claim.
    if (roles.length === 0) {
      const memberRole = await ctx.runQuery(internal.rolesInternal.getRoleBySlug, { slug: "member" });
      if (!memberRole) throw new Error("The default member role has not been seeded.");
      roleIds = [memberRole._id];
      roles = [memberRole];
    }
    if (roles.some((role) => role.slug === "platform_owner")) {
      throw new Error("The owner role can only be assigned during bootstrap.");
    }
    const primary = roles.slice().sort(
      (left: { rank: number }, right: { rank: number }) => right.rank - left.rank
    )[0];

    let workosUserId = await getWorkosUserByEmail(email);
    if (!workosUserId) workosUserId = await createWorkosUser(email);

    const membershipRole = primary?.workosRoleSlug ?? (primary ? workosSlugForRole(primary) : undefined);
    if (!membershipRole) throw new Error("The selected role is not synchronized to WorkOS.");
    await addWorkosOrganizationMembership(
      platformOrganizationIdForRoleSync(),
      workosUserId,
      membershipRole,
    );

    const userId = (await ctx.runMutation(internal.platformUsers.createUserLocal, {
      workosUserId,
      email,
      name: args.name?.trim() || undefined,
      jobTitle: args.jobTitle?.trim() || undefined,
      phone: args.phone?.trim() || undefined,
      roleIds: roles.map((role) => role._id),
      createdByUserId: actor.userId,
      marketId: args.marketId,
      marketRole: args.marketRole,
    })) as Id<"users">;

    await ctx.runMutation(internal.platformUsers.logUserAudit, {
      action: "user.create",
      userId,
      actorUserId: actor.userId,
      after: { email, name: args.name, primaryRoleSlug: primary?.slug, roleIds: roles.map((role) => role._id) },
    });

    return { userId, workosUserId };
  },
});

export const createUserLocal = internalMutation({
  args: {
    workosUserId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
    phone: v.optional(v.string()),
    roleIds: v.array(v.id("roles")),
    createdByUserId: v.id("users"),
    marketId: v.optional(v.id("markets")),
    marketRole: v.optional(marketMembershipRoleValidator),
  },
  handler: async (ctx, args) => {
    const roleIds = Array.from(new Set(args.roleIds));
    const roleRows = (await Promise.all(roleIds.map((roleId) => ctx.db.get(roleId))))
      .filter((row): row is NonNullable<typeof row> => row !== null && row.deletedAt === undefined);
    const primary = roleRows.slice().sort(
      (left: { rank: number }, right: { rank: number }) => right.rank - left.rank
    )[0];
    const primarySlug = primary?.slug;
    const now = Date.now();

    const userId = await ctx.db.insert("users", {
      workosUserId: args.workosUserId,
      email: args.email,
      name: args.name,
      jobTitle: args.jobTitle,
      phone: args.phone,
      isActive: true,
      roles: roleRows.map((row) => row._id),
      platformRole: primarySlug && PLATFORM_MIRROR_SLUGS.has(primarySlug)
        ? (primarySlug as "platform_owner" | "platform_admin" | "platform_support" | "agent")
        : undefined,
    });

    if (args.marketId && args.marketRole) {
      await ctx.db.insert("userMarketMemberships", {
        userId,
        marketId: args.marketId,
        role: args.marketRole,
        createdAt: now,
        updatedAt: now,
      });
    }

    return userId;
  },
});

/**
 * Soft-delete a directory user: strips roles, deactivates the account and
 * the WorkOS membership (revoking sessions). The row remains restorable.
 */
export const deleteUser = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = (await ctx.runQuery(internal.rolesInternal.authorize, { permission: "users:manage" })) as {
      userId: Id<"users">;
      workosUserId: string | null;
    };
    const target = await ctx.runQuery(internal.platformUsers.getUserForAccessUpdate, { userId: args.userId });
    if (!target) throw new Error("User not found.");
    if (target.deletedAt !== undefined) throw new Error("This account is already removed.");
    if (target._id === actor.userId) throw new Error("You cannot remove your own account.");
    if (target.platformRole === "platform_owner") {
      throw new Error("The platform owner's account cannot be removed.");
    }
    const targetRoles = await ctx.runQuery(internal.platformUsers.getRolesByIds, { roleIds: target.roles ?? [] });
    if (targetRoles.some((row) => row.slug === "platform_owner")) {
      throw new Error("The platform owner's account cannot be removed.");
    }

    if (target.workosUserId) {
      try {
        await deactivateWorkosMembership(target.workosUserId);
      } catch {
        // Best-effort: if there is no active membership, the local state still applies.
      }
    }

    await ctx.runMutation(internal.platformUsers.softDeleteUserLocal, {
      userId: args.userId,
      actorUserId: actor.userId,
    });
    await ctx.runMutation(internal.platformUsers.logUserAudit, {
      action: "user.delete",
      userId: args.userId,
      actorUserId: actor.userId,
      after: { email: target.email, name: target.name },
    });
    return args.userId;
  },
});

export const softDeleteUserLocal = internalMutation({
  args: { userId: v.id("users"), actorUserId: v.id("users") },
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.patch(args.userId, {
      deletedAt: now,
      deletedBy: args.actorUserId,
      isActive: false,
      deactivatedAt: now,
      roles: [],
      platformRole: undefined,
    });
    const memberships = await ctx.db
      .query("userMarketMemberships")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .collect();
    for (const membership of memberships) {
      await ctx.db.patch(membership._id, { revokedAt: now, updatedAt: now });
    }
  },
});

/** Bring a soft-deleted account back with its previous access (roles are restored by an admin). */
export const restoreUser = action({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const actor = (await ctx.runQuery(internal.rolesInternal.authorize, { permission: "trash:manage" })) as {
      userId: Id<"users">;
      workosUserId: string | null;
    };
    const target = await ctx.runQuery(internal.platformUsers.getUserForAccessUpdate, { userId: args.userId });
    if (!target) throw new Error("User not found.");
    if (target.deletedAt === undefined) throw new Error("This account has not been removed.");

    if (target.workosUserId) {
      try {
        await reactivateWorkosMembership(target.workosUserId);
      } catch {
        // The membership may no longer exist; the local restore still applies.
      }
    }

    await ctx.runMutation(internal.platformUsers.restoreUserLocal, {
      userId: args.userId,
      actorUserId: actor.userId,
    });
    await ctx.runMutation(internal.platformUsers.logUserAudit, {
      action: "user.restore",
      userId: args.userId,
      actorUserId: actor.userId,
      after: { email: target.email, name: target.name },
    });
    return args.userId;
  },
});

export const restoreUserLocal = internalMutation({
  args: { userId: v.id("users"), actorUserId: v.id("users") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.userId, {
      deletedAt: undefined,
      deletedBy: undefined,
      isActive: true,
      deactivatedAt: undefined,
    });
  },
});

export const logUserAudit = internalMutation({
  args: {
    action: v.string(),
    userId: v.id("users"),
    actorUserId: v.id("users"),
    after: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      action: args.action,
      entityTable: "users",
      entityId: args.userId,
      changedBy: args.actorUserId,
      afterJson: args.after !== undefined ? JSON.stringify(args.after) : undefined,
      timestamp: Date.now(),
    });
  },
});
