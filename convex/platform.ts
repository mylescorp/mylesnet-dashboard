import { v } from "convex/values";
import { query } from "./_generated/server";
import {
  isPlatformUser,
  permissionsOf,
  requirePlatformUser,
  resolveRoles,
  resolveUserByIdentity,
} from "./lib/auth";

/**
 * Returns the current authenticated platform user's role, permissions and
 * profile, or null if they are not signed in at all. Used by the layout guard
 * to decide whether to show the panel, bounce to /signin, or show /unauthorized.
 */
export const getCurrentPlatformUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) return null;

    const roles = await resolveRoles(ctx, user);
    const primary = roles.slice().sort((left, right) => right.rank - left.rank)[0] ?? null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      jobTitle: user.jobTitle,
      platformRole: user.platformRole ?? null,
      isPlatform: isPlatformUser(roles),
      canViewRevenue: roles.some((role) => role.permissions.includes("revenue:view")),
      permissions: permissionsOf(roles),
      roles: roles.map((role) => ({
        _id: role._id,
        slug: role.slug,
        name: role.name,
        isPlatform: role.isPlatform,
        rank: role.rank,
      })),
      primaryRole:
        primary !== null
          ? { slug: primary.slug, name: primary.name, isPlatform: primary.isPlatform }
          : null,
    };
  },
});

/** Read-only, paginated audit log view for /platform/audit-log. */
export const listAuditLog = query({
  args: {
    entityTable: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const limit = Math.min(100, args.limit ?? 50);
    const base = ctx.db.query("auditLog");
    if (args.entityTable) {
      return (
        await ctx.db
          .query("auditLog")
          .withIndex("by_entity", (q) => q.eq("entityTable", args.entityTable!))
          .order("desc")
          .take(limit)
      );
    }
    return (
      await base.order("desc").take(limit)
    );
  },
});

/** KPI cards for /platform — all driven by real Convex queries, no placeholders. */
export const getPlatformDashboardMetrics = query({
  args: { yearMonth: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);

    const currentYearMonth =
      args.yearMonth ??
      (() => {
        const now = new Date();
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
      })();

    const [openAlerts, activeMarkets, pendingOffboard, awaitingApproval] = await Promise.all([
      ctx.db
        .query("alerts")
        .withIndex("by_status", (q) => q.eq("alertStatus", "open"))
        .collect(),
      ctx.db
        .query("markets")
        .filter((q) =>
          q.and(
            q.eq(q.field("lifecycleStatus"), "active"),
            q.neq(q.field("status"), "deleted")
          )
        )
        .collect(),
      ctx.db
        .query("agents")
        .filter((q) =>
          q.and(
            q.eq(q.field("lifecycleStatus"), "terminated"),
            q.eq(q.field("status"), "deleted"),
            q.eq(q.field("deleteReason"), "Offboarded")
          )
        )
        .collect(),
      ctx.db
        .query("commissions")
        .withIndex("by_status", (q) => q.eq("payoutStatus", "requested"))
        .collect(),
    ]);

    const missingCostMarkets: Array<{ marketId: string; name: string }> = [];
    for (const market of activeMarkets) {
      const costEntry = await ctx.db
        .query("marketOperatingCosts")
        .withIndex("by_market_month", (q) =>
          q.eq("marketId", market._id).eq("yearMonth", currentYearMonth)
        )
        .first();
      if (!costEntry) {
        missingCostMarkets.push({ marketId: market._id, name: market.name });
      }
    }

    const unstaffedMarkets: string[] = [];
    for (const market of activeMarkets) {
      const hasActiveAgent = await ctx.db
        .query("agentMarketAssignments")
        .withIndex("by_market", (q) => q.eq("marketId", market._id))
        .filter((q) => q.eq(q.field("assignmentStatus"), "active"))
        .first();
      if (!hasActiveAgent) {
        unstaffedMarkets.push(market._id);
      }
    }

    const activeProspects = await ctx.db
      .query("marketProspects")
      .filter((q) =>
        q.and(
          q.neq(q.field("pipelineStatus"), "live"),
          q.eq(q.field("deletedAt"), undefined)
        )
      )
      .collect();

    return {
      openAlerts: openAlerts.length,
      activeMarkets: activeMarkets.length,
      pendingOffboard: pendingOffboard.length,
      awaitingApproval: awaitingApproval.length,
      missingCostMarkets: missingCostMarkets.map((m) => ({
        marketId: m.marketId,
        name: m.name,
        yearMonth: currentYearMonth,
      })),
      unstaffedMarkets: unstaffedMarkets.length,
      activeProspects: activeProspects.length,
    };
  },
});
