import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";

// Get dashboard summary data for all routers
export const getDashboardSummary = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const routers = await ctx.db.query("routers").collect();
    const openIncidents = await ctx.db
      .query("incidents")
      .withIndex("by_resolved", (q) => q.eq("resolvedAt", undefined))
      .collect();

    // Count health samples
    const healthSampleCount = await ctx.db.query("healthSamples").collect().then(samples => samples.length);

    return {
      totalRouters: routers.length,
      openIncidents: openIncidents.length,
      systemStatus: openIncidents.length === 0 ? "healthy" : "warning",
      configuredRouters: routers.length,
      healthSampleCount,
    };
  },
});

// Get detailed dashboard data for a specific router
export const getRouterDashboard = query({
  args: { routerId: v.optional(v.id("routers")) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    if (!args.routerId) {
      // Return aggregate data for all routers
      const routers = await ctx.db.query("routers").collect();
      const routerData = [];

      for (const router of routers) {
        const routerId = router._id;
        const healthSamples = await ctx.db
          .query("healthSamples")
          .withIndex("by_router_timestamp", (q) => q.eq("routerId", routerId))
          .order("desc")
          .take(100);

        // Filter for router-wide samples (no accessPointId)
        const healthSample = healthSamples.find(s => s.accessPointId === undefined) || null;

        const accessPoints = await ctx.db
          .query("accessPoints")
          .withIndex("by_router", (q) => q.eq("routerId", routerId))
          .collect();

        const accessPointHealth = await Promise.all(
          accessPoints.map(async (accessPoint) => ({
            accessPoint,
            health: await ctx.db
              .query("accessPointSamples")
              .withIndex("by_access_point_timestamp", (query) =>
                query.eq("accessPointId", accessPoint._id),
              )
              .order("desc")
              .first(),
          })),
        );

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
    const healthSamples = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", routerId))
      .order("desc")
      .take(100);

    // Filter for router-wide samples (no accessPointId)
    const healthSample = healthSamples.find(s => s.accessPointId === undefined) || null;

    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", routerId))
      .collect();

    const accessPointHealth = await Promise.all(
      accessPoints.map(async (accessPoint) => ({
        accessPoint,
        health: await ctx.db
          .query("accessPointSamples")
          .withIndex("by_access_point_timestamp", (query) =>
            query.eq("accessPointId", accessPoint._id),
          )
          .order("desc")
          .first(),
      })),
    );

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
    await requireAuthenticatedUser(ctx);
    const limit = args.limit || 5;
    const incidents = await ctx.db
      .query("incidents")
      .withIndex("by_resolved", (q) => q.eq("resolvedAt", undefined))
      .order("desc")
      .take(limit);

    return incidents;
  },
});

// Get DHCP pool status for a router
export const getDhcpPoolStatus = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    // This would typically fetch from RouterOS via action
    // For now, return placeholder
    return {
      routerId: args.routerId,
      pools: [],
      totalPools: 0,
      utilization: 0,
    };
  },
});
