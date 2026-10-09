import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { clampAnomalyWindowDays, detectBillingAnomalies } from "./lib/platformBillingAnomalyCore";

const anomalyType = v.union(v.literal("stale_pending"), v.literal("duplicate_reference"), v.literal("invoice_status_mismatch"), v.literal("negative_amount"));
const readRoles = ["platform_super_admin", "platform_finance", "platform_ops"];
const reviewRoles = ["platform_super_admin", "platform_ops"];

export const list = query({
  args: { days: v.optional(v.number()), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readRoles);
    const now = Date.now();
    const days = clampAnomalyWindowDays(args.days);
    const page = await ctx.db.query("payments")
      .withIndex("by_date", q => q.gte("paymentDate", now - days * 24 * 60 * 60 * 1000))
      .order("desc")
      .paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(50, Math.floor(args.paginationOpts.numItems))) });
    const findings = [];
    for (const payment of page.page) {
      const [duplicateRows, invoice, tenant] = await Promise.all([
        payment.reference.trim() ? ctx.db.query("payments").withIndex("by_gateway_reference", q => q.eq("gateway", payment.gateway).eq("reference", payment.reference)).take(2) : Promise.resolve([]),
        payment.invoiceId ? ctx.db.get(payment.invoiceId) : Promise.resolve(null),
        payment.tenantId ? ctx.db.get(payment.tenantId) : Promise.resolve(null),
      ]);
      const types = detectBillingAnomalies({
        status: payment.status,
        amount: payment.amount,
        paymentDate: payment.paymentDate,
        invoiceStatus: invoice && invoice.tenantId === payment.tenantId ? invoice.status : undefined,
        hasDuplicateReference: duplicateRows.length > 1,
      }, now);
      for (const type of types) {
        const review = await ctx.db.query("platformBillingAnomalyReviews")
          .withIndex("by_payment_and_type", q => q.eq("paymentId", payment._id).eq("anomalyType", type)).first();
        findings.push({
          key: `${payment._id}:${type}`,
          paymentId: payment._id,
          anomalyType: type,
          status: review?.status ?? "open",
          note: review?.note ?? null,
          amount: payment.amount,
          currency: payment.currency,
          gateway: payment.gateway,
          reference: payment.reference,
          paymentStatus: payment.status,
          paymentDate: payment.paymentDate,
          invoiceStatus: invoice && invoice.tenantId === payment.tenantId ? invoice.status : null,
          tenantName: tenant && !tenant.deletedAt ? tenant.name : null,
          sessionCorrelation: "unavailable",
        });
      }
    }
    return { ...page, page: findings };
  },
});

export const review = mutation({
  args: { paymentId: v.id("payments"), anomalyType, status: v.union(v.literal("open"), v.literal("acknowledged"), v.literal("resolved")), note: v.union(v.string(), v.null()) },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, reviewRoles);
    const payment = await ctx.db.get(args.paymentId);
    if (!payment) throw new Error("Payment record not found");
    const note = args.note === null ? undefined : args.note.trim();
    if (note && note.length > 1000) throw new Error("Review note must be 1,000 characters or fewer");
    const existing = await ctx.db.query("platformBillingAnomalyReviews")
      .withIndex("by_payment_and_type", q => q.eq("paymentId", args.paymentId).eq("anomalyType", args.anomalyType)).first();
    const now = Date.now();
    let reviewId;
    if (existing) {
      reviewId = existing._id;
      await ctx.db.patch(existing._id, { status: args.status, note, updatedBy: actor._id, updatedAt: now });
    } else {
      reviewId = await ctx.db.insert("platformBillingAnomalyReviews", { paymentId: args.paymentId, anomalyType: args.anomalyType, status: args.status, note, updatedBy: actor._id, updatedAt: now });
    }
    await logAudit(ctx, {
      action: "platform.billingAnomaly.reviewed",
      entityTable: "platformBillingAnomalyReviews",
      entityId: reviewId,
      changedBy: actor._id,
      before: existing ? { status: existing.status, note: existing.note ?? null } : { status: "open", note: null },
      after: { status: args.status, note: note ?? null, paymentId: args.paymentId, anomalyType: args.anomalyType },
    });
    return { status: args.status };
  },
});
