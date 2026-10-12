import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requireTenantPermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import {
  findSamePayment,
  normalizePaymentIdempotencyKey,
  type PaymentIdempotencyKey,
} from "./lib/paymentIdempotencyCore";

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

/**
 * Resolve the payment a submission should reuse, if one already exists. The
 * index lookup is the fast path; a second lookup with the raw (untrimmed) key
 * catches a row written before normalization, and `findSamePayment` confirms
 * the match with a trimmed comparison inside the tenant.
 */
async function findExistingPayment(
  ctx: MutationCtx,
  tenantId: Id<"tenants">,
  key: PaymentIdempotencyKey,
): Promise<Id<"payments"> | null> {
  const normalized = normalizePaymentIdempotencyKey(key);
  const byKey = (gateway: string, reference: string) =>
    ctx.db
      .query("payments")
      .withIndex("by_tenant_gateway_reference", (q) =>
        q.eq("tenantId", tenantId).eq("gateway", gateway).eq("reference", reference),
      )
      .first();
  const candidates: Doc<"payments">[] = [];
  const canonical = await byKey(normalized.gateway, normalized.reference);
  if (canonical) candidates.push(canonical);
  if (normalized.gateway !== key.gateway || normalized.reference !== key.reference) {
    const raw = await byKey(key.gateway, key.reference);
    if (raw) candidates.push(raw);
  }
  const match = findSamePayment(candidates, { tenantId, ...key });
  return match ? match._id : null;
}

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

    // Idempotency: a retried submission (a double click, or a client retry after
    // a timeout) must not record the same payment twice. Operators already treat
    // (gateway, reference) as unique inside one tenant, so a matching row is
    // returned instead of inserting a duplicate.
    const idempotency = normalizePaymentIdempotencyKey({
      gateway: args.gateway,
      reference: args.reference,
    });
    const existingId = await findExistingPayment(ctx, tenantId, {
      gateway: args.gateway,
      reference: args.reference,
    });
    if (existingId) return existingId;

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
      gateway: idempotency.gateway,
      reference: idempotency.reference,
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
      tenantId,
      after: {
        amount: args.amount,
        currency: args.currency,
        gateway: idempotency.gateway,
        reference: idempotency.reference,
      },
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

    // Keep the idempotency key canonical. Normalize the stored pair, and refuse
    // a change that would collide with another payment's key in this tenant.
    if (updates.gateway !== undefined || updates.reference !== undefined) {
      const normalized = normalizePaymentIdempotencyKey({
        gateway: updates.gateway ?? payment.gateway,
        reference: updates.reference ?? payment.reference,
      });
      const clash = await findExistingPayment(ctx, tenantId, normalized);
      if (clash && clash !== id) {
        throw new Error("Another payment already uses this gateway reference");
      }
      updates.gateway = normalized.gateway;
      updates.reference = normalized.reference;
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
      tenantId,
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
      tenantId,
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
