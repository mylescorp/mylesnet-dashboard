import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requireNetworkOperator, requirePlatformOwner } from "./lib/auth";
import { encryptRouterCredential, isEncryptedRouterCredential } from "./lib/routerCredentials";

// List routers WITHOUT credentials (safe for client queries)
export const listRouters = query({
  handler: async (ctx) => {
    await requireNetworkOperator(ctx);
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
export const getRouterCredentials = internalQuery({
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

export const getRouterWithCredentials = internalQuery({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.db.get(args.routerId);
    if (!router) return null;

    const credentials = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();
    if (!credentials) return null;

    return {
      router: { restBaseUrl: router.restBaseUrl },
      username: credentials.encryptedUsername,
      password: credentials.encryptedPassword,
    };
  },
});

export const getCollectorConnection = internalQuery({
  args: { routerId: v.string() },
  handler: async (ctx, args) => {
    const routerId = await ctx.db.normalizeId("routers", args.routerId);
    if (!routerId) return null;

    const router = await ctx.db.get(routerId);
    if (!router) return null;

    const credentials = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", routerId))
      .first();
    if (!credentials) return null;

    return {
      restBaseUrl: router.restBaseUrl,
      username: credentials.encryptedUsername,
      password: credentials.encryptedPassword,
    };
  },
});

export const getLatestConfigurationBaseline = internalQuery({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) =>
    ctx.db
      .query("configWatchBaselines")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .first(),
});

export const getLatestRouterConfigurationSnapshot = internalQuery({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) =>
    ctx.db
      .query("routerConfigurationSnapshots")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .first(),
});

export const saveConfigurationBaseline = internalMutation({
  args: { routerId: v.id("routers"), snapshotJson: v.string() },
  handler: async (ctx, args) =>
    ctx.db.insert("configWatchBaselines", {
      routerId: args.routerId,
      snapshotJson: args.snapshotJson,
      capturedAt: Date.now(),
    }),
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
    await requireNetworkOperator(ctx);
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
      encryptedUsername: await encryptRouterCredential(args.username),
      encryptedPassword: await encryptRouterCredential(args.password),
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
    await requireNetworkOperator(ctx);
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
    await requireNetworkOperator(ctx);
    const existing = await ctx.db
      .query("routerCredentials")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        encryptedUsername: await encryptRouterCredential(args.username),
        encryptedPassword: await encryptRouterCredential(args.password),
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("routerCredentials", {
        routerId: args.routerId,
        encryptedUsername: await encryptRouterCredential(args.username),
        encryptedPassword: await encryptRouterCredential(args.password),
        updatedAt: Date.now(),
      });
    }
  },
});

/** Converts legacy plaintext router credentials without changing router records. */
export const migrateLegacyRouterCredentials = mutation({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    const credentials = await ctx.db.query("routerCredentials").collect();
    let migrated = 0;
    for (const credential of credentials) {
      if (isEncryptedRouterCredential(credential.encryptedUsername) && isEncryptedRouterCredential(credential.encryptedPassword)) continue;
      await ctx.db.patch(credential._id, {
        encryptedUsername: isEncryptedRouterCredential(credential.encryptedUsername)
          ? credential.encryptedUsername
          : await encryptRouterCredential(credential.encryptedUsername),
        encryptedPassword: isEncryptedRouterCredential(credential.encryptedPassword)
          ? credential.encryptedPassword
          : await encryptRouterCredential(credential.encryptedPassword),
        updatedAt: Date.now(),
      });
      migrated += 1;
    }
    return { migrated };
  },
});

/** Owner-only migration status. It never returns credential values. */
export const getRouterCredentialProtectionStatus = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformOwner(ctx);
    const credentials = await ctx.db.query("routerCredentials").collect();
    return {
      total: credentials.length,
      legacy: credentials.filter((credential) =>
        !isEncryptedRouterCredential(credential.encryptedUsername) ||
        !isEncryptedRouterCredential(credential.encryptedPassword),
      ).length,
    };
  },
});

// Delete a router and its credentials
export const deleteRouter = mutation({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
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
