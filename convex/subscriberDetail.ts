import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { requireTenantMember } from "./lib/tenant";

/**
 * Deep, tenant-scoped subscriber record: profile, plan, payment history,
 * invoices and audit trail in one read model for the subscriber detail page.
 */
export const getDetail = query({
  args: { subscriberId: v.id("subscribers") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "subscribers:read");
    const tenantId = await requireTenantMember(ctx);

    const subscriber = await ctx.db.get(args.subscriberId);
    if (!subscriber || subscriber.deletedAt !== undefined) return null;
    if (subscriber.tenantId !== tenantId) {
      throw new Error("Unauthorized: subscriber belongs to another tenant");
    }

    const [plan, payments, invoices, auditRows] = await Promise.all([
      subscriber.planId ? ctx.db.get(subscriber.planId) : Promise.resolve(null),
      ctx.db
        .query("payments")
        .withIndex("by_subscriber", (q) => q.eq("subscriberId", subscriber._id))
        .collect(),
      ctx.db
        .query("invoices")
        .withIndex("by_subscriber", (q) => q.eq("subscriberId", subscriber._id))
        .collect(),
      ctx.db
        .query("auditLog")
        .filter((q) =>
          q.and(
            q.eq(q.field("entityTable"), "subscribers"),
            q.eq(q.field("entityId"), args.subscriberId),
          ),
        )
        .order("desc")
        .limit(30)
        .collect(),
    ]);

    const scopedPayments = payments.filter((p) => p.tenantId === tenantId);
    const scopedInvoices = invoices.filter((i) => i.tenantId === tenantId);
    const completed = scopedPayments
      .filter((p) => p.status === "completed")
      .sort((a, b) => b.paymentDate - a.paymentDate);

    return {
      subscriber,
      plan: plan
        ? {
            name: plan.name,
            code: plan.code,
            category: plan.category,
            priceLocal: plan.priceLocal,
            currency: plan.currency,
            durationLabel: plan.durationLabel ?? null,
          }
        : null,
      payments: scopedPayments.sort((a, b) => b.paymentDate - a.paymentDate),
      invoices: scopedInvoices.sort((a, b) => b.createdAt - a.createdAt),
      audit: auditRows,
      lifetimeTotal: completed.reduce((sum, p) => sum + p.amount, 0),
      lastPayment: completed[0] ?? null,
      totalPaidCount: completed.length,
    };
  },
});