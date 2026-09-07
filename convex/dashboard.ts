import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthenticatedUser, requireMarketAccess } from "./lib/auth";

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
    if (router.marketId) {
      await requireMarketAccess(ctx, router.marketId, "viewer");
    }

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
    const router = await ctx.db.get(args.routerId);
    if (!router) return null;
    if (router.marketId) {
      await requireMarketAccess(ctx, router.marketId, "viewer");
    }
    const snapshot = await ctx.db
      .query("routerConfigurationSnapshots")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .first();
    const leases = await ctx.db
      .query("dhcpLeases")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();
    const pools: Array<{ name?: string; ranges?: string; capacity: number; used: number; utilization: number }> = [];
    if (snapshot?.snapshotJson) {
      try {
        const config = JSON.parse(snapshot.snapshotJson) as {
          pools?: Array<{ name?: string; ranges?: string }>;
        };
        for (const pool of config.pools ?? []) {
          const ranges = pool.ranges ?? "";
          let capacity = 0;
          for (const range of ranges.split(",")) {
            const [start, end] = range.split("-").map((part) => part.trim());
            const startParts = start?.split(".").map(Number) ?? [];
            const endParts = end?.split(".").map(Number) ?? [];
            if (startParts.length !== 4 || endParts.length !== 4) continue;
            const startInt = ((startParts[0] << 24) | (startParts[1] << 16) | (startParts[2] << 8) | startParts[3]) >>> 0;
            const endInt = ((endParts[0] << 24) | (endParts[1] << 16) | (endParts[2] << 8) | endParts[3]) >>> 0;
            if (endInt >= startInt) capacity += endInt - startInt + 1;
          }
          const used = leases.filter((lease) =>
            ranges.split(",").some((range) => {
              const [start, end] = range.split("-").map((part) => part.trim());
              const ip = lease.ipAddress.split(".").map(Number);
              const a = start?.split(".").map(Number) ?? [];
              const b = end?.split(".").map(Number) ?? [];
              if (ip.length !== 4 || a.length !== 4 || b.length !== 4) return false;
              const value = ((ip[0] << 24) | (ip[1] << 16) | (ip[2] << 8) | ip[3]) >>> 0;
              const low = ((a[0] << 24) | (a[1] << 16) | (a[2] << 8) | a[3]) >>> 0;
              const high = ((b[0] << 24) | (b[1] << 16) | (b[2] << 8) | b[3]) >>> 0;
              return value >= low && value <= high;
            }),
          ).length;
          pools.push({ name: pool.name, ranges: pool.ranges, capacity, used, utilization: capacity ? Math.min(100, (used / capacity) * 100) : 0 });
        }
      } catch {
        // A malformed collector snapshot is represented as no parsed pools.
      }
    }
    const totalCapacity = pools.reduce((sum, pool) => sum + pool.capacity, 0);
    return {
      routerId: args.routerId,
      pools,
      totalPools: pools.length,
      utilization: totalCapacity ? Math.min(100, (leases.length / totalCapacity) * 100) : 0,
      totalCapacity,
      totalUsed: leases.length,
      observedAt: snapshot?.observedAt,
    };
  },
});
