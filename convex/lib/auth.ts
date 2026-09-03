import { QueryCtx, MutationCtx, ActionCtx } from "../_generated/server";
import { Id, Doc } from "../_generated/dataModel";

/**
 * Role hierarchy for /platform (Master Admin):
 *
 *   platform_owner   - you. Everything, including irreversible actions
 *   platform_admin   - day-to-day ops
 *   platform_support - read-only + ticket handling
 *   agent            - client-facing, /dashboard only, NOT in this hierarchy
 */

export type PlatformRole =
  | "platform_owner"
  | "platform_admin"
  | "platform_support"
  | "agent";

/**
 * Resolve the authenticated user's record by email.
 *
 * The platform stores users in Convex with a Convex-generated `_id`, but under
 * WorkOS AuthKit the auth identity `subject` is a WorkOS user id (user_...),
 * which is NOT a valid Convex `users._id`. So we match on the identity email
 * instead, using the `users` table's `email` index.
 */
export async function resolveUserByIdentity(
  ctx: QueryCtx | MutationCtx
): Promise<Doc<"users"> | null> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) return null;
  const byWorkosId = await ctx.db
    .query("users")
    .withIndex("by_workosUserId", (q) => q.eq("workosUserId", identity.subject))
    .first();
  if (byWorkosId) return byWorkosId;
  if (!identity.email) return null;
  const email = identity.email.toLowerCase();
  return (await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", email))
      .first()) ?? null;
}

async function getCurrentUserRecord(ctx: QueryCtx | MutationCtx) {
  const user = await resolveUserByIdentity(ctx);
  if (!user) {
    throw new Error("Unauthenticated");
  }
  return user;
}

function isActiveUser(user: Doc<"users">): boolean {
  return user.isActive !== false && user.deactivatedAt === undefined;
}

/** Require any authenticated platform user (owner/admin/support). */
export async function requirePlatformUser(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserRecord(ctx);
  if (!isActiveUser(user)) throw new Error("Unauthorized: account is inactive");
  if (
    user.platformRole !== "platform_owner" &&
    user.platformRole !== "platform_admin" &&
    user.platformRole !== "platform_support"
  ) {
    throw new Error("Unauthorized: platform access required");
  }
  return user;
}

/** Require platform_owner or platform_admin */
export async function requirePlatformAdmin(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserRecord(ctx);
  if (!isActiveUser(user)) throw new Error("Unauthorized: account is inactive");
  if (user.platformRole !== "platform_owner" && user.platformRole !== "platform_admin") {
    throw new Error("Unauthorized: admin role required");
  }
  return user;
}

/** Require platform_owner */
export async function requirePlatformOwner(ctx: QueryCtx | MutationCtx) {
  const user = await getCurrentUserRecord(ctx);
  if (!isActiveUser(user)) throw new Error("Unauthorized: account is inactive");
  if (user.platformRole !== "platform_owner") {
    throw new Error("Unauthorized: owner role required");
  }
  return user;
}

/** Require any authenticated user (works from actions too). */
export async function requireAuthenticatedUser(
  ctx: ActionCtx | QueryCtx | MutationCtx
): Promise<Id<"users">> {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");

  // Actions cannot read the database directly, so they can only assert that the
  // caller is authenticated (their existing callers don't use the returned id).
  if (!("db" in ctx)) {
    return identity.subject as Id<"users">;
  }

  const user = await resolveUserByIdentity(ctx);
  if (!user || !isActiveUser(user)) throw new Error("Unauthenticated");
  return user._id;
}

/** Network Operations is a module inside the platform, not a second auth realm. */
export async function requireNetworkOperator(ctx: QueryCtx | MutationCtx) {
  return requirePlatformUser(ctx);
}

export async function requireMarketAccess(
  ctx: QueryCtx | MutationCtx,
  marketId: Id<"markets">,
  minimumRole: "manager" | "operator" | "viewer" = "viewer",
) {
  const user = await getCurrentUserRecord(ctx);
  if (!isActiveUser(user)) throw new Error("Unauthorized: account is inactive");
  if (user.platformRole === "platform_owner" || user.platformRole === "platform_admin") return user;
  const membership = await ctx.db
    .query("userMarketMemberships")
    .withIndex("by_user_and_market", (q) => q.eq("userId", user._id).eq("marketId", marketId))
    .first();
  const rank = { viewer: 1, operator: 2, manager: 3 } as const;
  if (!membership || membership.revokedAt !== undefined || rank[membership.role] < rank[minimumRole]) {
    throw new Error("Unauthorized: market access required");
  }
  return user;
}

/** Commission payout self-approval guard */
export function assertNotSelfApproval(
  requestedBy: Id<"users"> | undefined,
  approverUserId: Id<"users">,
  approverRole: PlatformRole | undefined
) {
  if (approverRole === "platform_owner") return;
  if (requestedBy && requestedBy === approverUserId) {
    throw new Error(
      "Unauthorized: cannot approve a commission payout you requested yourself"
    );
  }
}
