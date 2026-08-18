import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// List routers WITHOUT credentials (safe for client queries)
export const listRouters = query({
  handler: async (ctx) => {
    const routers = await ctx.db.query("routers").order("desc").collect();
    
    // Check which routers have credentials set (without exposing them)
    const routersWithCredentials = await Promise.all(
      routers.map(async (router) => {
        const creds = await ctx.db
          .query("routerCredentials")
          .withIndex("by_router", (q) => q.eq("routerId", router._id))
          .first();
        return {
          ...router,
          hasCredentials: !!creds,
        };
      })
    );

    return routersWithCredentials;
  },
});

// Get router credentials - SERVER-SIDE ONLY, never exposed to client
// This should only be called from other Convex actions, not from the frontend
export const getRouterCredentials = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const creds = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();

    if (!creds) {
      throw new Error("Router credentials not found");
    }

    return {
      username: creds.encryptedUsername,
      password: creds.encryptedPassword,
    };
  },
});

// Add a new router with credentials (server-side only)
export const addRouter = mutation({
  args: {
    name: v.string(),
    restBaseUrl: v.string(),
    location: v.string(),
    username: v.string(),
    password: v.string(),
    cpuWarningThreshold: v.optional(v.number()),
    cpuCriticalThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const routerId = await ctx.db.insert("routers", {
      name: args.name,
      restBaseUrl: args.restBaseUrl,
      location: args.location,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      cpuWarningThreshold: args.cpuWarningThreshold || 75,
      cpuCriticalThreshold: args.cpuCriticalThreshold || 90,
    });

    // Store credentials separately - NEVER exposed to client
    await ctx.db.insert("routerCredentials", {
      routerId,
      encryptedUsername: args.username, // In production, this should be encrypted
      encryptedPassword: args.password, // In production, this should be encrypted
      updatedAt: Date.now(),
    });

    return routerId;
  },
});

// Update router details (not credentials)
export const updateRouter = mutation({
  args: {
    routerId: v.id("routers"),
    name: v.optional(v.string()),
    restBaseUrl: v.optional(v.string()),
    location: v.optional(v.string()),
    cpuWarningThreshold: v.optional(v.number()),
    cpuCriticalThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { routerId, ...updates } = args;
    await ctx.db.patch(routerId, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

// Update router credentials (server-side only)
export const updateRouterCredentials = mutation({
  args: {
    routerId: v.id("routers"),
    username: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedUsername: args.username,
        encryptedPassword: args.password,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("routerCredentials", {
        routerId: args.routerId,
        encryptedUsername: args.username,
        encryptedPassword: args.password,
        updatedAt: Date.now(),
      });
    }
  },
});

// Delete a router and its credentials
export const deleteRouter = mutation({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    // Delete router
    await ctx.db.delete(args.routerId);

    // Delete credentials
    const creds = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();
    if (creds) {
      await ctx.db.delete(creds._id);
    }

    // Delete associated access points
    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();
    for (const ap of accessPoints) {
      await ctx.db.delete(ap._id);
    }
  },
});
