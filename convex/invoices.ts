import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireTenantPermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const list = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("draft"),
        v.literal("issued"),
        v.literal("paid"),
        v.literal("overdue"),
        v.literal("cancelled"),
      ),
    ),
    subscriberId: v.optional(v.id("subscribers")),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "invoices:read");

    let invoices = await ctx.db.query("invoices").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).order("desc").collect();

    if (args.status) {
      invoices = invoices.filter((i) => i.status === args.status);
    }

    if (args.subscriberId) {
      invoices = invoices.filter((i) => i.subscriberId === args.subscriberId);
    }

    const start = args.startDate;
    if (start) {
      invoices = invoices.filter((i) => i.createdAt >= start);
    }

    const end = args.endDate;
    if (end) {
      invoices = invoices.filter((i) => i.createdAt <= end);
    }

    return invoices;
  },
});

export const get = query({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const { tenantId } = await requireTenantPermission(ctx, "invoices:read");
    const invoice = await ctx.db.get(args.id);

    if (!invoice || invoice.tenantId !== tenantId) {
      return null;
    }

    // Fetch line items
    const lineItems = (await ctx.db
      .query("invoiceLineItems")
      .withIndex("by_invoice", (q) => q.eq("invoiceId", args.id))
      .collect()).filter((item) => item.tenantId === tenantId);

    return {
      ...invoice,
      lineItems,
    };
  },
});

export const create = mutation({
  args: {
    invoiceNumber: v.string(),
    subscriberId: v.optional(v.id("subscribers")),
    currency: v.string(),
    subtotal: v.number(),
    tax: v.number(),
    discount: v.number(),
    total: v.number(),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
    lineItems: v.array(
      v.object({
        description: v.string(),
        quantity: v.number(),
        unitPrice: v.number(),
        total: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "invoices:create");

    if (args.subscriberId) {
      const subscriber = await ctx.db.get(args.subscriberId);
      if (!subscriber || subscriber.tenantId !== tenantId) {
        throw new Error("Subscriber not found");
      }
    }

    const { lineItems, ...invoiceData } = args;

    const id = await ctx.db.insert("invoices", {
      ...invoiceData,
      tenantId,
      status: "draft",
      operatorId: user._id,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    // Create line items
    for (const item of lineItems) {
      await ctx.db.insert("invoiceLineItems", {
        invoiceId: id,
        tenantId,
        ...item,
        createdAt: Date.now(),
      });
    }

    await logAudit(ctx, {
      action: "invoices.create",
      entityTable: "invoices",
      entityId: id,
      changedBy: user._id,
      after: { invoiceNumber: args.invoiceNumber, total: args.total },
    });

    return id;
  },
});

export const update = mutation({
  args: {
    id: v.id("invoices"),
    invoiceNumber: v.optional(v.string()),
    subscriberId: v.optional(v.id("subscribers")),
    currency: v.optional(v.string()),
    subtotal: v.optional(v.number()),
    tax: v.optional(v.number()),
    discount: v.optional(v.number()),
    total: v.optional(v.number()),
    dueDate: v.optional(v.number()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "invoices:update");

    const { id, ...updates } = args;
    const invoice = await ctx.db.get(id);

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found");
    }

    if (invoice.status !== "draft") {
      throw new Error("Only draft invoices can be edited");
    }

    if (updates.subscriberId) {
      const subscriber = await ctx.db.get(updates.subscriberId);
      if (!subscriber || subscriber.tenantId !== tenantId) {
        throw new Error("Subscriber not found");
      }
    }

    await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "invoices.update",
      entityTable: "invoices",
      entityId: id,
      changedBy: user._id,
      before: invoice,
      after: updates,
    });

    return id;
  },
});

export const issue = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "invoices:issue");

    const invoice = await ctx.db.get(args.id);

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found");
    }

    if (invoice.status !== "draft") {
      throw new Error("Only draft invoices can be issued");
    }

    await ctx.db.patch(args.id, {
      status: "issued",
      issuedDate: Date.now(),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "invoices.issue",
      entityTable: "invoices",
      entityId: args.id,
      changedBy: user._id,
      before: { status: invoice.status },
      after: { status: "issued" },
    });

    return args.id;
  },
});

export const markPaid = mutation({
  args: { id: v.id("invoices") },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "invoices:mark_paid");

    const invoice = await ctx.db.get(args.id);

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      throw new Error("Invoice is already paid");
    }

    await ctx.db.patch(args.id, {
      status: "paid",
      paidDate: Date.now(),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "invoices.markPaid",
      entityTable: "invoices",
      entityId: args.id,
      changedBy: user._id,
      before: { status: invoice.status },
      after: { status: "paid" },
    });

    return args.id;
  },
});

export const cancel = mutation({
  args: { id: v.id("invoices"), reason: v.string() },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "invoices:cancel");

    const invoice = await ctx.db.get(args.id);

    if (!invoice || invoice.tenantId !== tenantId) {
      throw new Error("Invoice not found");
    }

    if (invoice.status === "paid") {
      throw new Error("Cannot cancel a paid invoice");
    }

    await ctx.db.patch(args.id, {
      status: "cancelled",
      notes: invoice.notes
        ? `${invoice.notes}\n\nCancelled: ${args.reason}`
        : `Cancelled: ${args.reason}`,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "invoices.cancel",
      entityTable: "invoices",
      entityId: args.id,
      changedBy: user._id,
      before: { status: invoice.status },
      after: { status: "cancelled", reason: args.reason },
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
    const { tenantId } = await requireTenantPermission(ctx, "invoices:read");

    let invoices = await ctx.db.query("invoices").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect();

    const start = args.startDate;
    if (start) {
      invoices = invoices.filter((i) => i.createdAt >= start);
    }

    const end = args.endDate;
    if (end) {
      invoices = invoices.filter((i) => i.createdAt <= end);
    }

    return {
      total: invoices.length,
      draft: invoices.filter((i) => i.status === "draft").length,
      issued: invoices.filter((i) => i.status === "issued").length,
      paid: invoices.filter((i) => i.status === "paid").length,
      overdue: invoices.filter((i) => i.status === "overdue").length,
      cancelled: invoices.filter((i) => i.status === "cancelled").length,
      totalAmount: invoices.reduce(
        (sum, i) => sum + (i.status === "paid" ? i.total : 0),
        0,
      ),
      outstandingAmount: invoices.reduce(
        (sum, i) =>
          sum + (i.status === "issued" || i.status === "overdue" ? i.total : 0),
        0,
      ),
    };
  },
});
