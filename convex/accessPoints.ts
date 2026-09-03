import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireNetworkOperator } from "./lib/auth";

// Add an access point to a router
export const addAccessPoint = mutation({
  args: {
    routerId: v.id("routers"),
    name: v.string(),
    port: v.string(),
    deviceType: v.union(v.literal("cpe220"), v.literal("indoor_ap"), v.literal("builtin_radio"), v.literal("other")),
    sharesPortWith: v.optional(v.string()),
    capacity: v.optional(v.number()),
    rateLimitReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
    return await ctx.db.insert("accessPoints", {
      routerId: args.routerId,
      name: args.name,
      port: args.port,
      deviceType: args.deviceType,
      sharesPortWith: args.sharesPortWith,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

// List access points for a router
export const listAccessPoints = query({
  args: { routerId: v.optional(v.id("routers")) },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
    if (!args.routerId) {
      return await ctx.db.query("accessPoints").collect();
    }
    const routerId = args.routerId;
    return await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", routerId))
      .collect();
  },
});

// Update access point
export const updateAccessPoint = mutation({
  args: {
    accessPointId: v.id("accessPoints"),
    name: v.optional(v.string()),
    port: v.optional(v.string()),
    deviceType: v.optional(v.union(v.literal("cpe220"), v.literal("indoor_ap"), v.literal("builtin_radio"), v.literal("other"))),
    sharesPortWith: v.optional(v.string()),
    capacity: v.optional(v.number()),
    rateLimitReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
    const { accessPointId, ...updates } = args;
    await ctx.db.patch(accessPointId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Delete access point
export const deleteAccessPoint = mutation({
  args: { accessPointId: v.id("accessPoints") },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
    await ctx.db.delete(args.accessPointId);
  },
});
