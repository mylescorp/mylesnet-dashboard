import { v } from "convex/values";
import { MutationCtx, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePermission, requireTenantPermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { enforceTenantOnResource, readTenantList } from "./lib/tenant";

async function assertMarketTenant(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  marketId: Id<"markets"> | undefined,
) {
  if (!marketId) return;
  const market = await ctx.db.get(marketId);
  if (!market || market.tenantId !== tenantId) {
    throw new Error("Unauthorized: market belongs to another tenant");
  }
}

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
    
    let expenses = await readTenantList<Doc<"expenses">>(ctx, {
      all: () => ctx.db.query("expenses").order("desc").collect(),
      tenant: (tenantId) =>
        ctx.db.query("expenses").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("expenses").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    
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
    return await enforceTenantOnResource(ctx, await ctx.db.get(args.id), "expense");
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
    const { user, tenantId } = await requireTenantPermission(ctx, "expenses:create");
    await assertMarketTenant(ctx, tenantId, args.marketId);
    
    const id = await ctx.db.insert("expenses", {
      ...args,
      tenantId,
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
    const { user, tenantId } = await requireTenantPermission(ctx, "expenses:update");
    
    const { id, ...updates } = args;
    const expense = await enforceTenantOnResource(ctx, await ctx.db.get(id), "expense");
    
    if (!expense) {
      throw new Error("Expense not found");
    }
    if (expense.tenantId !== tenantId) throw new Error("Unauthorized: expense belongs to another tenant");
    
    await ctx.db.patch(id, updates);
    
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
    return await readTenantList<Doc<"marketFinancials">>(ctx, {
      all: () => ctx.db.query("marketFinancials").order("desc").collect(),
      tenant: (tenantId) =>
        ctx.db.query("marketFinancials").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("marketFinancials").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "expenses:update");

    const expense = await enforceTenantOnResource(ctx, await ctx.db.get(args.id), "expense");
    if (!expense) throw new Error("Expense not found");
    if (expense.tenantId !== tenantId) throw new Error("Unauthorized: expense belongs to another tenant");

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
    
    let expenses = await readTenantList<Doc<"expenses">>(ctx, {
      all: () => ctx.db.query("expenses").collect(),
      tenant: (tenantId) =>
        ctx.db.query("expenses").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("expenses").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    
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
