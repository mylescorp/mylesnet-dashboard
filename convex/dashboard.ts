import { v } from "convex/values";
import { query } from "./_generated/server";

// Get dashboard summary data for all routers
export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    const routers = await ctx.db.query("routers").collect();
    const openIncidents = await ctx.db
      .query("incidents")
      .filter((q) => q.eq(q.field("resolvedAt"), undefined))
      .collect();

    return {
      totalRouters: routers.length,
      openIncidents: openIncidents.length,
      systemStatus: openIncidents.length === 0 ? "healthy" : "warning",
      configuredRouters: routers.length,
    };
  },
});

// Get detailed dashboard data for a specific router
export const getRouterDashboard = query({
  args: { routerId: v.optional(v.id("routers")) },
  handler: async (ctx, args) => {
    if (!args.routerId) {
      // Return aggregate data for all routers
      const routers = await ctx.db.query("routers").collect();
      const routerData = [];

      for (const router of routers) {
        const routerId = router._id;
        const healthSample = await ctx.db
          .query("healthSamples")
          .withIndex("by_router_timestamp", (q) => q.eq("routerId", routerId))
          .filter((q) => q.eq(q.field("accessPointId"), undefined))
          .order("desc")
          .first();

        const accessPoints = await ctx.db
          .query("accessPoints")
          .withIndex("by_router", (q) => q.eq("routerId", routerId))
          .collect();

        const accessPointHealth = [];
        for (const ap of accessPoints) {
          const apHealth = await ctx.db
            .query("healthSamples")
            .withIndex("by_router_timestamp", (q) => q.eq("routerId", routerId))
            .filter((q) => q.eq(q.field("accessPointId"), ap._id))
            .order("desc")
            .first();

          accessPointHealth.push({
            accessPoint: ap,
            health: apHealth,
          });
        }

        routerData.push({
          router,
          health: healthSample,
          accessPoints: accessPointHealth,
          cpuWarningThreshold: router.cpuWarningThreshold || 75,
          cpuCriticalThreshold: router.cpuCriticalThreshold || 90,
        });
      }

      return routerData;
    }

    // Return data for specific router
    const router = await ctx.db.get(args.routerId);
    if (!router) return null;

    const routerId = args.routerId;
    const healthSample = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", routerId))
      .filter((q) => q.eq(q.field("accessPointId"), undefined))
      .order("desc")
      .first();

    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", routerId))
      .collect();

    const accessPointHealth = [];
    for (const ap of accessPoints) {
      const apHealth = await ctx.db
        .query("healthSamples")
        .withIndex("by_router_timestamp", (q) => q.eq("routerId", routerId))
        .filter((q) => q.eq(q.field("accessPointId"), ap._id))
        .order("desc")
        .first();

      accessPointHealth.push({
        accessPoint: ap,
        health: apHealth,
      });
    }

    return [
      {
        router,
        health: healthSample,
        accessPoints: accessPointHealth,
        cpuWarningThreshold: router.cpuWarningThreshold || 75,
        cpuCriticalThreshold: router.cpuCriticalThreshold || 90,
      },
    ];
  },
});

// Get recent open incidents for dashboard alert banner
export const getRecentIncidents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const limit = args.limit || 5;
    const incidents = await ctx.db
      .query("incidents")
      .filter((q) => q.eq(q.field("resolvedAt"), undefined))
      .order("desc")
      .take(limit);

    return incidents;
  },
});