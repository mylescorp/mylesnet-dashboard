import { v } from "convex/values";
import { internalQuery } from "./_generated/server";
import { requirePermission, resolveRoles } from "./lib/auth";

/**
 * Internal role-registry helpers used by `rolesAdmin` actions. Kept in their
 * own module so the public roles CRUD actions never reference their own module
 * through the generated `internal` namespace (avoids cyclic type inference).
 */

/** Who is the caller and what is their highest-privilege role slug? */
export const authorize = internalQuery({
  args: { permission: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, args.permission);
    const roles = await resolveRoles(ctx, user);
    if (roles.length === 0) throw new Error("Unauthorized");
    const primary = roles.reduce((best, role) => (role.rank > best.rank ? role : best), roles[0]);
    return { userId: user._id, workosUserId: user.workosUserId ?? null, primaryRoleSlug: primary.slug };
  },
});

export const getRoleBySlug = internalQuery({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db.query("roles").withIndex("by_slug", (q) => q.eq("slug", args.slug)).first();
    return row && row.deletedAt === undefined ? row : null;
  },
});

export const getRoleById = internalQuery({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.roleId);
    return row && row.deletedAt === undefined ? row : null;
  },
});

/** Resolve a WorkOS role slug (e.g. "org-field-supervisor") to a local role id. */
export const getRoleIdByWorkosSlug = internalQuery({
  args: { slug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.slug) return null;
    const role = await ctx.db
      .query("roles")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug!))
      .filter((q) => q.eq(q.field("deletedAt"), undefined))
      .first();
    if (role) return role._id;
    const custom = await ctx.db
      .query("roles")
      .filter((q) =>
        q.and(
          q.eq(q.field("workosRoleSlug"), args.slug!),
          q.eq(q.field("deletedAt"), undefined),
        )
      )
      .first();
    return custom?._id ?? null;
  },
});

export const countRoleAssignments = internalQuery({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const users = await ctx.db.query("users").collect();
    return users.filter((user) => (user.roles ?? []).includes(args.roleId)).length;
  },
});