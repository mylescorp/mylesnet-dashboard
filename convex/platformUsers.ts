import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requirePlatformOwner, requirePlatformUser, resolveUserByIdentity } from "./lib/auth";

const platformRoleValidator = v.union(
  v.literal("platform_owner"),
  v.literal("platform_admin"),
  v.literal("platform_support"),
  v.literal("agent"),
);

const marketMembershipRoleValidator = v.union(
  v.literal("manager"),
  v.literal("operator"),
  v.literal("viewer"),
);

/**
 * Public mutation allowing signed-in users to update their profile name,
 * phone number, and avatar image.
 */
export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
    jobTitle: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) throw new Error("Unauthenticated");

    const patchData: { name?: string; phone?: string; image?: string; jobTitle?: string; profileCompletedAt?: number } = {};
    if (args.name !== undefined) patchData.name = args.name.trim();
    if (args.phone !== undefined) patchData.phone = args.phone.trim();
    if (args.image !== undefined) patchData.image = args.image.trim();
    if (args.jobTitle !== undefined) patchData.jobTitle = args.jobTitle.trim();
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

/** Return platform identities together with their active market scopes. */
export const listUsers = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    const users = await ctx.db.query("users").take(500);
    return Promise.all(users.map(async (user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      jobTitle: user.jobTitle,
      platformRole: user.platformRole ?? null,
      isActive: user.isActive !== false && user.deactivatedAt === undefined,
      marketMemberships: await ctx.db
        .query("userMarketMemberships")
        .withIndex("by_user", (q) => q.eq("userId", user._id))
        .collect(),
    })));
  },
});

/** Platform owners assign least-privilege local access; WorkOS sync is performed by the paired action. */
export const setUserAccess = mutation({
  args: {
    userId: v.id("users"),
    platformRole: v.optional(platformRoleValidator),
    isActive: v.boolean(),
    marketId: v.optional(v.id("markets")),
    marketRole: v.optional(marketMembershipRoleValidator),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformOwner(ctx);
    const target = await ctx.db.get(args.userId);
    if (!target) throw new Error("User not found");
    if (target._id === actor._id && !args.isActive) throw new Error("You cannot deactivate your own account");
    await ctx.db.patch(target._id, {
      platformRole: args.platformRole,
      isActive: args.isActive,
      deactivatedAt: args.isActive ? undefined : Date.now(),
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
      afterJson: JSON.stringify({ platformRole: args.platformRole, isActive: args.isActive, marketId: args.marketId, marketRole: args.marketRole }),
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
    const user = await requirePlatformUser(ctx);
    return user._id;
  },
});

/**
 * Atomic guard + write for setting the authenticated user's platformRole.
 *
 * Runs as an internal mutation so the one-shot owner guarantee is enforced
 * atomically: only the first caller can become platform_owner.
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

    await ctx.db.patch(user._id, { platformRole: args.platformRole });
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
