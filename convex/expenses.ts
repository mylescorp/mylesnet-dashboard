import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const list = query({
  args: {
    category: v.optional(v.union(
      v.literal("airtel_data"),
      v.literal("electricity"),
      v.literal("rent"),
      v.literal("salaries"),
      v.literal("fuel"),
      v.literal("maintenance"),
      v.literal("equipment"),
      v.literal("other")
    )),
    month: v.optional(v.string()),
    type: v.optional(v.union(v.literal("fixed"), v.literal("variable"))),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "expenses:read");
    
    let expenses = await ctx.db.query("expenses").order("desc").collect();
    
    if (args.category) {
      expenses = expenses.filter(e => e.category === args.category);
    }
    
    if (args.month) {
      expenses = expenses.filter(e => e.month === args.month);
    }
    
    if (args.type) {
      expenses = expenses.filter(e => e.type === args.type);
    }
    
    return expenses;
  },
});

export const get = query({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "expenses:read");
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    marketId: v.optional(v.id("markets")),
    category: v.union(
      v.literal("airtel_data"),
      v.literal("electricity"),
      v.literal("rent"),
      v.literal("salaries"),
      v.literal("fuel"),
      v.literal("maintenance"),
      v.literal("equipment"),
      v.literal("other")
    ),
    amountLocal: v.number(),
    currency: v.string(),
    amountUSD: v.number(),
    type: v.union(v.literal("fixed"), v.literal("variable")),
    month: v.string(),
    receiptFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "expenses:create");
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");
    
    const id = await ctx.db.insert("expenses", {
      ...args,
      enteredBy: user._id,
      enteredAt: Date.now(),
    });
    
    await logAudit(ctx, {
      action: "expense_created",
      entityTable: "expenses",
      entityId: id,
      changedBy: user._id,
      after: args,
    });
    
    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("expenses"),
    category: v.optional(v.union(
      v.literal("airtel_data"),
      v.literal("electricity"),
      v.literal("rent"),
      v.literal("salaries"),
      v.literal("fuel"),
      v.literal("maintenance"),
      v.literal("equipment"),
      v.literal("other")
    )),
    amountLocal: v.optional(v.number()),
    currency: v.optional(v.string()),
    amountUSD: v.optional(v.number()),
    type: v.optional(v.union(v.literal("fixed"), v.literal("variable"))),
    month: v.optional(v.string()),
    receiptFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "expenses:update");
    
    const { id, ...updates } = args;
    const expense = await ctx.db.get(id);
    
    if (!expense) {
      throw new Error("Expense not found");
    }
    
    await ctx.db.patch(id, updates);
    
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    
    const user = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", identity.subject))
      .first();
    
    if (!user) throw new Error("User not found");
    
    await logAudit(ctx, {
      action: "expense_updated",
      entityTable: "expenses",
      entityId: id,
      changedBy: user._id,
      before: expense,
      after: updates,
    });
    
    return id;
  },
});

export const listAllFinancials = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "expenses:read");
    return await ctx.db.query("marketFinancials").order("desc").collect();
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "expenses:update");

    const expense = await ctx.db.get(args.id);
    if (!expense) throw new Error("Expense not found");

    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const user = await ctx.db
      .query("users")
      .withIndex("by_workosUserId", (q) => q.eq("workosUserId", identity.subject))
      .first();
    if (!user) throw new Error("User not found");

    await ctx.db.delete(args.id);

    await logAudit(ctx, {
      action: "expenses.remove",
      entityTable: "expenses",
      entityId: args.id,
      changedBy: user._id,
      before: expense,
    });

    return args.id;
  },
});

export const getStats = query({
  args: {
    month: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "expenses:read");
    
    let expenses = await ctx.db.query("expenses").collect();
    
    if (args.month) {
      expenses = expenses.filter(e => e.month === args.month);
    }
    
    return {
      total: expenses.length,
      fixed: expenses.filter(e => e.type === "fixed").length,
      variable: expenses.filter(e => e.type === "variable").length,
      totalAmountLocal: expenses.reduce((sum, e) => sum + e.amountLocal, 0),
      totalAmountUSD: expenses.reduce((sum, e) => sum + e.amountUSD, 0),
    };
  },
});
