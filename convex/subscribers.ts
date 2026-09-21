import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTenantPermission } from "./lib/auth";

// ==========================================================================
// QUERIES
// ==========================================================================

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("expired"),
        v.literal("suspended"),
        v.literal("disabled"),
        v.literal("at_risk"),
        v.literal("churned"),
      ),
    ),
    connectionType: v.optional(
      v.union(v.literal("pppoe"), v.literal("hotspot")),
    ),
    planId: v.optional(v.id("plans")),
    search: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "subscribers:read");

    let results;

    if (args.status) {
      results = await ctx.db
        .query("subscribers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
    } else if (args.planId) {
      results = await ctx.db
        .query("subscribers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect();
    } else {
      results = await ctx.db.query("subscribers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    }

    // Filter out soft-deleted records
    const activeResults = results.filter(
      (s) =>
        s.deletedAt === undefined &&
        (!args.status || s.status === args.status) &&
        (!args.planId || s.planId === args.planId),
    );

    // Apply connectionType filter if provided
    let filteredResults = activeResults;
    if (args.connectionType) {
      filteredResults = filteredResults.filter(
        (s) => s.connectionType === args.connectionType,
      );
    }

    // Apply search filter if provided
    if (args.search) {
      const searchLower = args.search.toLowerCase();
      filteredResults = filteredResults.filter(
        (s) =>
          s.name.toLowerCase().includes(searchLower) ||
          s.accountNumber.toLowerCase().includes(searchLower) ||
          (s.username && s.username.toLowerCase().includes(searchLower)) ||
          (s.email && s.email.toLowerCase().includes(searchLower)) ||
          s.phone.includes(searchLower) ||
          (s.macAddress && s.macAddress.toLowerCase().includes(searchLower)),
      );
    }

    return filteredResults;
  },
});

export const get = query({
  args: { id: v.id("subscribers") },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "subscribers:read");
    const subscriber = await ctx.db.get(args.id);

    if (!subscriber || subscriber.tenantId !== tenantId || subscriber.deletedAt !== undefined) {
      return null;
    }

    return subscriber;
  },
});

export const getStats = query({
  args: {},
  handler: async (ctx) => {
    const { tenantId } = await requireTenantPermission(ctx, "subscribers:read");

    const allSubscribers = await ctx.db.query("subscribers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();
    const activeSubscribers = allSubscribers.filter(
      (s) => s.deletedAt === undefined,
    );

    return {
      total: activeSubscribers.length,
      active: activeSubscribers.filter((s: any) => s.status === "active")
        .length,
      expired: activeSubscribers.filter((s: any) => s.status === "expired")
        .length,
      suspended: activeSubscribers.filter((s: any) => s.status === "suspended")
        .length,
      atRisk: activeSubscribers.filter((s: any) => s.status === "at_risk")
        .length,
      churned: activeSubscribers.filter((s: any) => s.status === "churned")
        .length,
    };
  },
});

// ==========================================================================
// MUTATIONS
// ==========================================================================

export const create = mutation({
  args: {
    accountNumber: v.string(),
    name: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    planId: v.optional(v.id("plans")),
    connectionType: v.union(v.literal("pppoe"), v.literal("hotspot")),
    macAddress: v.optional(v.string()),
    currency: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "subscribers:create");

    // Check if account number already exists
    const existing = await ctx.db
      .query("subscribers")
      .withIndex("by_account_number", (q) =>
        q.eq("accountNumber", args.accountNumber),
      )
      .first();

    if (existing && existing.tenantId === tenantId) {
      throw new Error("Account number already exists");
    }

    const id = await ctx.db.insert("subscribers", {
      ...args,
      tenantId,
      status: "active",
      walletBalance: 0,
      createdBy: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("subscribers"),
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    email: v.optional(v.string()),
    username: v.optional(v.string()),
    planId: v.optional(v.id("plans")),
    connectionType: v.optional(
      v.union(v.literal("pppoe"), v.literal("hotspot")),
    ),
    macAddress: v.optional(v.string()),
    status: v.optional(
      v.union(
        v.literal("active"),
        v.literal("expired"),
        v.literal("suspended"),
        v.literal("disabled"),
        v.literal("at_risk"),
        v.literal("churned"),
      ),
    ),
    expiryDate: v.optional(v.number()),
    walletBalance: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "subscribers:update");

    const { id, ...updates } = args;
    const subscriber = await ctx.db.get(id);

    if (!subscriber || subscriber.tenantId !== tenantId || subscriber.deletedAt !== undefined) {
      throw new Error("Subscriber not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    return id;
  },
});

export const softDelete = mutation({
  args: { id: v.id("subscribers") },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "subscribers:delete");

    const subscriber = await ctx.db.get(args.id);
    if (!subscriber || subscriber.tenantId !== tenantId || subscriber.deletedAt !== undefined) {
      throw new Error("Subscriber not found");
    }

    await ctx.db.patch(args.id, {
      deletedAt: Date.now(),
      deletedBy: user._id,
    });

    return args.id;
  },
});

export const restore = mutation({
  args: { id: v.id("subscribers") },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "subscribers:delete");

    const subscriber = await ctx.db.get(args.id);
    if (!subscriber || subscriber.tenantId !== tenantId || subscriber.deletedAt === undefined) {
      throw new Error("Subscriber not found or not deleted");
    }

    await ctx.db.patch(args.id, {
      deletedAt: undefined,
      deletedBy: undefined,
      updatedAt: Date.now(),
    });

    return args.id;
  },
});

// ==========================================================================
// SPECIAL ACTIONS
// ==========================================================================

export const renew = mutation({
  args: {
    id: v.id("subscribers"),
    days: v.number(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "subscribers:update");

    const subscriber = await ctx.db.get(args.id);
    if (!subscriber || subscriber.tenantId !== tenantId || subscriber.deletedAt !== undefined) {
      throw new Error("Subscriber not found");
    }

    const newExpiry = args.days * 24 * 60 * 60 * 1000;
    const currentExpiry = subscriber.expiryDate || Date.now();
    const extendedExpiry = currentExpiry + newExpiry;

    await ctx.db.patch(args.id, {
      expiryDate: extendedExpiry,
      status: "active",
      updatedAt: Date.now(),
    });

    return extendedExpiry;
  },
});

export const creditAccount = mutation({
  args: {
    id: v.id("subscribers"),
    amount: v.number(),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "subscribers:financial");

    const subscriber = await ctx.db.get(args.id);
    if (!subscriber || subscriber.tenantId !== tenantId || subscriber.deletedAt !== undefined) {
      throw new Error("Subscriber not found");
    }

    if (args.amount <= 0) {
      throw new Error("Amount must be positive");
    }

    await ctx.db.patch(args.id, {
      walletBalance: subscriber.walletBalance + args.amount,
      updatedAt: Date.now(),
    });

    return subscriber.walletBalance + args.amount;
  },
});
