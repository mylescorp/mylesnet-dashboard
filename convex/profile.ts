import { v } from "convex/values";
import { action, internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import { requireAuthenticatedUser, resolveUserByIdentity } from "./lib/auth";

const ALLOWED_AVATAR_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;

/** Return a one-time upload URL for the signed-in user's avatar. */
export const generateAvatarUploadUrl = action({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const uploadUrl = await ctx.storage.generateUploadUrl();
    return { uploadUrl };
  },
});

/** Persist a just-uploaded avatar blob onto the caller's profile. */
export const saveAvatar = action({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    await ctx.runMutation(internal.profile.applyAvatar, { storageId: args.storageId });
    return { saved: true };
  },
});

export const applyAvatar = internalMutation({
  args: { storageId: v.string() },
  handler: async (ctx, args) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) throw new Error("Unauthenticated");
    if (user.isActive === false || user.deactivatedAt !== undefined) {
      throw new Error("Unauthorized: account is inactive");
    }

    const metadata = await ctx.storage.getMetadata(args.storageId);
    if (!metadata) throw new Error("The uploaded file could not be found.");
    if (!ALLOWED_AVATAR_MIME_TYPES.has(metadata.contentType ?? "")) {
      throw new Error("Avatars must be a JPG, PNG, WebP or GIF image.");
    }
    if (metadata.size > MAX_AVATAR_SIZE_BYTES) {
      throw new Error("Avatars must be 5 MB or smaller.");
    }

    const url = await ctx.storage.getUrl(args.storageId);
    await ctx.db.patch(user._id, { image: url ?? user.image, avatarStorageId: args.storageId });

    if (user.avatarStorageId && user.avatarStorageId !== args.storageId) {
      try {
        await ctx.storage.delete(user.avatarStorageId);
      } catch {
        // Old blob may already be gone; the new avatar is still valid.
      }
    }

    await ctx.db.insert("auditLog", {
      action: "user.update_avatar",
      entityTable: "users",
      entityId: user._id,
      changedBy: user._id,
      afterJson: JSON.stringify({ storageId: args.storageId }),
      timestamp: Date.now(),
    });
  },
});

export const removeAvatar = action({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    await ctx.runMutation(internal.profile.clearAvatar, {});
    return { removed: true };
  },
});

export const clearAvatar = internalMutation({
  args: {},
  handler: async (ctx) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) throw new Error("Unauthenticated");
    const storageId = user.avatarStorageId;
    await ctx.db.patch(user._id, { image: undefined, avatarStorageId: undefined });
    if (storageId) {
      try {
        await ctx.storage.delete(storageId);
      } catch {
        // Nothing to reclaim; mirror is already cleared.
      }
    }
  },
});