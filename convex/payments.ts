import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTenantPermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

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
    const { tenantId } = await requireTenantPermission(ctx, "payments:read");

    let payments = await ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).order("desc").collect();

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
    const { tenantId } = await requireTenantPermission(ctx, "payments:read");
    const payment = await ctx.db.get(args.id);
    return payment?.tenantId === tenantId ? payment : null;
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
    const { user, tenantId } = await requireTenantPermission(ctx, "payments:create");

    const references = [args.subscriberId, args.invoiceId, args.planId];
    const [subscriber, invoice, plan] = await Promise.all(
      references.map((id) => (id ? ctx.db.get(id) : null)),
    );
    if (
      (subscriber && subscriber.tenantId !== tenantId) ||
      (invoice && invoice.tenantId !== tenantId) ||
      (plan && plan.tenantId !== tenantId)
    ) {
      throw new Error("Payment references must belong to the active workspace");
    }

    const id = await ctx.db.insert("payments", {
      ...args,
      tenantId,
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
    const { user, tenantId } = await requireTenantPermission(ctx, "payments:update");

    const { id, ...updates } = args;
    const payment = await ctx.db.get(id);

    if (!payment || payment.tenantId !== tenantId) {
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
    const { user, tenantId } = await requireTenantPermission(ctx, "payments:refund");

    const payment = await ctx.db.get(args.id);

    if (!payment || payment.tenantId !== tenantId) {
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
    const { tenantId } = await requireTenantPermission(ctx, "payments:read");

    let payments = await ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();

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
