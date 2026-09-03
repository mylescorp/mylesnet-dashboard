import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";

// Get latest health sample for a specific router
export const getLatestRouterHealth = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const healthSamples = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .take(100);

    return healthSamples.find(s => s.accessPointId === undefined) || null;
  },
});

// Get latest health samples for all access points on a router
export const getLatestAccessPointHealth = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();

    const healthData = await Promise.all(
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
    await requireAuthenticatedUser(ctx);
    const hours = args.hours || 24;
    const cutoff = Date.now() - hours * 60 * 60 * 1000;

    const healthSamples = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId).gte("timestamp", cutoff))
      .collect();

    return healthSamples.filter(s => s.accessPointId === undefined);
  },
});

// Get router-wide health summary for all routers
export const getAllRouterHealth = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const routers = await ctx.db.query("routers").collect();

    const healthData = await Promise.all(
      routers.map(async (router) => {
        const healthSamples = await ctx.db
          .query("healthSamples")
          .withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id))
          .order("desc")
          .take(100);

        const healthSample = healthSamples.find(s => s.accessPointId === undefined);

        return {
          router,
          health: healthSample || null,
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
    await requireAuthenticatedUser(ctx);
    const samples = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .take(1);
    return samples[0]?.connectedUserCount ?? null;
  },
});
