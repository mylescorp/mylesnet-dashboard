import { v } from "convex/values";
import { internalMutation, internalQuery } from "./_generated/server";
import { requirePermission, resolveRoles } from "./lib/auth";

/**
 * Internal invitation helpers used by the `invitations` actions and the
 * WorkOS webhook dispatcher. Kept out of `invitations.ts` so its public
 * actions never reference their own module through `internal` (avoids
 * cyclic type inference).
 */

/** Who is the caller (for attribution) and what is their highest role? */
export const getInvitationAuthor = internalQuery({
  args: { permission: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.permission);
    const roles = await resolveRoles(ctx, user);
    const primary = roles.slice().sort((left, right) => right.rank - left.rank)[0];
    return {
      userId: user._id,
      workosUserId: user.workosUserId ?? null,
      primaryRoleName: primary?.name ?? null,
    };
  },
});

export const getInvitationById = internalQuery({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => ctx.db.get(args.invitationId),
});

export const getRoleById = internalQuery({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.roleId);
    return row && row.deletedAt === undefined ? row : null;
  },
});

/** Idempotent upsert of a WorkOS invitation into the local registry. */
export const applyInvitation = internalMutation({
  args: {
    workosInvitationId: v.string(),
    email: v.string(),
    organizationId: v.string(),
    roleId: v.optional(v.id("roles")),
    roleSlug: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
    invitedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("invitations")
      .withIndex("by_workosId", (q) => q.eq("workosInvitationId", args.workosInvitationId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        status: args.status,
        roleId: args.roleId,
        roleSlug: args.roleSlug,
        expiresAt: args.expiresAt,
        acceptedAt: args.acceptedAt ?? existing.acceptedAt,
        revokedAt: args.status === "revoked" ? Date.now() : existing.revokedAt,
      });
      return existing._id;
    }
    return ctx.db.insert("invitations", {
      workosInvitationId: args.workosInvitationId,
      email: args.email,
      roleId: args.roleId,
      roleSlug: args.roleSlug,
      organizationId: args.organizationId,
      status: args.status,
      invitedByUserId: args.invitedByUserId,
      createdAt: args.createdAt,
      expiresAt: args.expiresAt,
      acceptedAt: args.acceptedAt,
    });
  },
});

export const logInvitationAudit = internalMutation({
  args: {
    action: v.string(),
    workosInvitationId: v.string(),
    email: v.string(),
    roleSlug: v.optional(v.string()),
    actorUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLog", {
      action: args.action,
      entityTable: "invitations",
      entityId: args.workosInvitationId,
      changedBy: args.actorUserId,
      afterJson: JSON.stringify({ email: args.email, roleSlug: args.roleSlug }),
      timestamp: Date.now(),
    });
  },
});