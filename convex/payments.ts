import { v } from "convex/values";
import { MutationCtx, mutation, query } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { enforceTenantOnResource, readTenantList, tenantIdForWrite } from "./lib/tenant";

async function requireUser(ctx: MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();
  if (!identity) throw new Error("Unauthenticated");
  const user = await ctx.db
    .query("users")
    .withIndex("by_workosUserId", (q) => q.eq("workosUserId", identity.subject))
    .first();
  if (!user) throw new Error("User not found");
  return user;
}

async function assertPaymentReferencesTenant(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  args: { subscriberId?: Id<"subscribers">; invoiceId?: Id<"invoices">; planId?: Id<"plans"> },
) {
  const [subscriber, invoice, plan] = await Promise.all([
    args.subscriberId ? ctx.db.get(args.subscriberId) : null,
    args.invoiceId ? ctx.db.get(args.invoiceId) : null,
    args.planId ? ctx.db.get(args.planId) : null,
  ]);
  if (args.subscriberId && (!subscriber || subscriber.tenantId !== tenantId)) throw new Error("Unauthorized: subscriber belongs to another tenant");
  if (args.invoiceId && (!invoice || invoice.tenantId !== tenantId)) throw new Error("Unauthorized: invoice belongs to another tenant");
  if (args.planId && (!plan || plan.tenantId !== tenantId)) throw new Error("Unauthorized: plan belongs to another tenant");
}

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("refunded"),
      ),
    ),
    subscriberId: v.optional(v.id("subscribers")),
    invoiceId: v.optional(v.id("invoices")),
    gateway: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payments:read");

    let payments = await readTenantList<Doc<"payments">>(ctx, {
      all: () => ctx.db.query("payments").order("desc").collect(),
      tenant: (tenantId) =>
        ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });

    if (args.status) {
      payments = payments.filter((p) => p.status === args.status);
    }

    if (args.subscriberId) {
      payments = payments.filter((p) => p.subscriberId === args.subscriberId);
    }

    if (args.invoiceId) {
      payments = payments.filter((p) => p.invoiceId === args.invoiceId);
    }

    if (args.gateway) {
      payments = payments.filter((p) => p.gateway === args.gateway);
    }

    const start = args.startDate;
    if (start) {
      payments = payments.filter((p) => p.paymentDate >= start);
    }

    const end = args.endDate;
    if (end) {
      payments = payments.filter((p) => p.paymentDate <= end);
    }

    return payments;
  },
});

export const get = query({
  args: { id: v.id("payments") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payments:read");
    return await enforceTenantOnResource(ctx, await ctx.db.get(args.id), "payment");
  },
});

export const create = mutation({
  args: {
    subscriberId: v.optional(v.id("subscribers")),
    invoiceId: v.optional(v.id("invoices")),
    planId: v.optional(v.id("plans")),
    amount: v.number(),
    currency: v.string(),
    gateway: v.string(),
    reference: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("completed"),
      v.literal("failed"),
      v.literal("refunded"),
    ),
    paymentDate: v.number(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payments:create");
    const user = await requireUser(ctx);
    const tenantId = await tenantIdForWrite(ctx);
    if (tenantId) await assertPaymentReferencesTenant(ctx, tenantId, args);

    const id = await ctx.db.insert("payments", {
      ...args,
      ...(tenantId ? { tenantId } : {}),
      operatorId: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "payments.create",
      entityTable: "payments",
      entityId: id,
      changedBy: user._id,
      after: { amount: args.amount, currency: args.currency, gateway: args.gateway, reference: args.reference },
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("payments"),
    status: v.optional(
      v.union(
        v.literal("pending"),
        v.literal("completed"),
        v.literal("failed"),
        v.literal("refunded"),
      ),
    ),
    gateway: v.optional(v.string()),
    reference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payments:update");
    const user = await requireUser(ctx);

    const { id, ...updates } = args;
    const payment = await enforceTenantOnResource(ctx, await ctx.db.get(id), "payment");

    if (!payment) {
      throw new Error("Payment not found");
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "payments.update",
      entityTable: "payments",
      entityId: id,
      changedBy: user._id,
      before: { status: payment.status },
      after: updates,
    });

    return id;
  },
});

export const refund = mutation({
  args: {
    id: v.id("payments"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payments:refund");
    const user = await requireUser(ctx);

    const payment = await enforceTenantOnResource(ctx, await ctx.db.get(args.id), "payment");

    if (!payment) {
      throw new Error("Payment not found");
    }

    if (payment.status !== "completed") {
      throw new Error("Only completed payments can be refunded");
    }

    await ctx.db.patch(args.id, {
      status: "refunded",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "payments.refund",
      entityTable: "payments",
      entityId: args.id,
      changedBy: user._id,
      before: { status: payment.status },
      after: { status: "refunded", reason: args.reason },
    });

    return args.id;
  },
});

export const getStats = query({
  args: {
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "payments:read");

    let payments = await readTenantList<Doc<"payments">>(ctx, {
      all: () => ctx.db.query("payments").collect(),
      tenant: (tenantId) =>
        ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () =>
        ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });

    const start = args.startDate;
    if (start) {
      payments = payments.filter((p) => p.paymentDate >= start);
    }

    const end = args.endDate;
    if (end) {
      payments = payments.filter((p) => p.paymentDate <= end);
    }

    return {
      total: payments.length,
      completed: payments.filter((p) => p.status === "completed").length,
      pending: payments.filter((p) => p.status === "pending").length,
      failed: payments.filter((p) => p.status === "failed").length,
      refunded: payments.filter((p) => p.status === "refunded").length,
      totalAmount: payments.reduce(
        (sum, p) => sum + (p.status === "completed" ? p.amount : 0),
        0,
      ),
    };
  },
});
