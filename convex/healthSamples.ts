import { v } from "convex/values";
import { query } from "./_generated/server";

// Get latest health sample for a specific router
export const getLatestRouterHealth = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const healthSample = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .filter((q) => q.eq(q.field("accessPointId"), undefined))
      .order("desc")
      .first();

    return healthSample;
  },
});

// Get latest health samples for all access points on a router
export const getLatestAccessPointHealth = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();

    const healthData = await Promise.all(
      accessPoints.map(async (ap) => {
        const healthSample = await ctx.db
          .query("healthSamples")
          .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
          .filter((q) => q.eq(q.field("accessPointId"), ap._id))
          .order("desc")
          .first();

        return {
          accessPoint: ap,
          health: healthSample,
        };
      })
    );

    return healthData;
  },
});

// Get health samples for the last 24 hours for a router
export const getRouterHealthHistory = query({
  args: { 
    routerId: v.id("routers"),
    hours: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const hours = args.hours || 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    const healthSamples = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId).gte("timestamp", cutoff))
      .filter((q) => q.eq(q.field("accessPointId"), undefined))
      .collect();

    return healthSamples;
  },
});

// Get router-wide health summary for all routers
export const getAllRouterHealth = query({
  args: {},
  handler: async (ctx) => {
    const routers = await ctx.db.query("routers").collect();

    const healthData = await Promise.all(
      routers.map(async (router) => {
        const healthSample = await ctx.db
          .query("healthSamples")
          .withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id))
          .filter((q) => q.eq(q.field("accessPointId"), undefined))
          .order("desc")
          .first();

        return {
          router,
          health: healthSample,
        };
      })
    );

    return healthData;
  },
});

// Get count of connected users (from hotspot sessions)
export const getConnectedUserCount = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // This would typically come from real-time hotspot data
    // For now, return placeholder until RouterOS integration is active
    return 0;
  },
});