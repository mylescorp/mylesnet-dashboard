import { action, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { resolveUserByIdentity } from "./lib/auth";
import { setOwnWorkosRole } from "./workos";

/**
 * One-time bootstrap: the first authenticated user claims the platform owner
 * role.
 *
 * The claim updates BOTH sides so the two auth layers stay in sync:
 *  - WorkOS: sets the user's organization membership role to `platform_owner`,
 *    which the JWT emits as the `role` claim.
 *  - Convex: sets the user's `platformRole` to "platform_owner" locally.
 *
 * If an owner already exists, we abort before touching WorkOS so a second
 * user is never promoted there. Otherwise WorkOS is updated first, then
 * Convex is set through the atomically-guarded internal mutation
 * (`platformUsers:setPlatformRole`), which re-validates the one-shot rule.
 */
export const claimPlatformOwner = action({
  args: {},
  handler: async (ctx): Promise<{ claimedBy: Id<"users"> }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const allowlistedEmails = (process.env.MYLESNET_BOOTSTRAP_OWNER_EMAILS ?? "")
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean);
    if (!identity.email || !allowlistedEmails.includes(identity.email.toLowerCase())) {
      throw new Error("Unauthorized bootstrap request");
    }

    // Pre-check so we never promote a second user to WorkOS owner before the
    // atomically-guarded Convex write rejects it.
    const ownerId = await ctx.runQuery(internal.platformUsers.getPlatformOwnerId, {});
    if (ownerId) {
      // Re-run the guarded mutation to surface the authoritative error
      // ("already the owner" for the same user, "owner exists" otherwise).
      await ctx.runMutation(internal.platformUsers.setPlatformRole, {
        platformRole: "platform_owner",
      });
      throw new Error("A platform owner already exists. This bootstrap runs once only.");
    }

    // Reflect the role in WorkOS first so the JWT `role` claim matches.
    await setOwnWorkosRole(ctx, "platform_owner");

    // Persist the local platformRole through the atomically-guarded mutation.
    const userId = await ctx.runMutation(internal.platformUsers.setPlatformRole, {
      platformRole: "platform_owner",
    });

    return { claimedBy: userId };
  },
});

/** Whether the calling user can still claim the owner role. */
export const ownerClaimStatus = query({
  args: {},
  handler: async (ctx) => {
    const owner = await ctx.db
      .query("users")
      .withIndex("by_platformRole", (q) => q.eq("platformRole", "platform_owner"))
      .first();
    const currentUser = await resolveUserByIdentity(ctx);
    return {
      ownerExists: !!owner,
      isCurrentUserOwner: !!currentUser && currentUser.platformRole === "platform_owner",
      isCurrentUserPlatformUser:
        !!currentUser &&
        (currentUser.platformRole === "platform_owner" ||
          currentUser.platformRole === "platform_admin" ||
          currentUser.platformRole === "platform_support"),
    };
  },
});
