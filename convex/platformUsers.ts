import { v } from "convex/values";
import { internalMutation, internalQuery, mutation } from "./_generated/server";
import { resolveUserByIdentity } from "./lib/auth";

/**
 * Public mutation allowing signed-in users to update their profile name,
 * phone number, and avatar image.
 */
export const updateUserProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) throw new Error("Unauthenticated");

    const patchData: { name?: string; phone?: string; image?: string } = {};
    if (args.name !== undefined) patchData.name = args.name.trim();
    if (args.phone !== undefined) patchData.phone = args.phone.trim();
    if (args.image !== undefined) patchData.image = args.image.trim();

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