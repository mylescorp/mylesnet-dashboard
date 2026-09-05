import { query } from "./_generated/server";
import { requirePermission, resolveRoles, resolveUserByIdentity } from "./lib/auth";

export const getOrganizationOverview = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "organizations:read");
    const organizationId = process.env.MYLESNET_PLATFORM_ORG_ID;
    if (!organizationId) return null;

    const memberships = await ctx.db
      .query("organizationMemberships")
      .withIndex("by_org", (q) => q.eq("organizationId", organizationId))
      .collect();

    const activeMemberships = memberships.filter((membership) => membership.status === "active");

    const roleBySlug = new Map<string, string>();
    const roles = await ctx.db.query("roles").collect();
    for (const role of roles) {
      if (role.deletedAt !== undefined) continue;
      roleBySlug.set(role.slug, role.name);
      if (role.workosRoleSlug) roleBySlug.set(role.workosRoleSlug, role.name);
    }

    const distribution = new Map<string, number>();
    for (const membership of activeMemberships) {
      const slug = membership.roleSlug ?? "member";
      distribution.set(slug, (distribution.get(slug) ?? 0) + 1);
    }

    const self = await resolveUserByIdentity(ctx);
    const selfRoles = self ? await resolveRoles(ctx, self) : [];

    return {
      organizationId,
      displayName: "MylesNet Platform",
      totalMemberships: memberships.length,
      activeMemberships: activeMemberships.length,
      pendingMemberships: memberships.filter((membership) => membership.status === "pending").length,
      inactiveMemberships: memberships.filter((membership) => membership.status === "inactive").length,
      roleDistribution: Array.from(distribution.entries()).map(([slug, count]) => ({
        slug,
        name: roleBySlug.get(slug) ?? slug,
        count,
      })),
      currentUserRoles: selfRoles.map((role) => ({ slug: role.slug, name: role.name, isPlatform: role.isPlatform })),
    };
  },
});