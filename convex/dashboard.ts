import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { requireTenantMember } from "./lib/tenant";

/**
 * Live tenant dashboard metrics. Every number is computed from tenant-scoped
 * records at read time — nothing is stored or hardcoded.
 */
export const getMetrics = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "dashboard:access");
    const tenantId = await requireTenantMember(ctx);

    const now = Date.now();
    const dayStart = new Date();
    dayStart.setHours(0, 0, 0, 0);
    const startOfToday = dayStart.getTime();

    const [tenant, subscribers, payments, tickets, markets] = await Promise.all([
      ctx.db.get(tenantId),
      ctx.db
        .query("subscribers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
      ctx.db
        .query("payments")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
      ctx.db
        .query("supportTickets")
        .filter((q) => q.eq(q.field("tenantId"), tenantId))
        .collect(),
      ctx.db
        .query("markets")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
    ]);

    const todayPayments = payments.filter(
      (p) =>
        p.status === "completed" &&
        p.paymentDate >= startOfToday &&
        p.paymentDate <= now,
    );
    const revenueToday = todayPayments.reduce((sum, p) => sum + p.amount, 0);

    const currencyTotal = new Map<string, number>();
    for (const payment of todayPayments) {
      currencyTotal.set(
        payment.currency,
        (currencyTotal.get(payment.currency) ?? 0) + payment.amount,
      );
    }
    const dominantCurrency =
      Array.from(currencyTotal.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] ??
      tenant?.currency ??
      "USD";

    const activeSubscriptions = subscribers.filter(
      (s) => s.deletedAt === undefined && s.status === "active",
    ).length;
    const newSignupsToday = subscribers.filter(
      (s) =>
        s.deletedAt === undefined &&
        s.createdAt >= startOfToday &&
        s.createdAt <= now,
    ).length;
    const openTickets = tickets.filter(
      (t) =>
        t.deletedAt === undefined &&
        t.ticketStatus !== "resolved" &&
        t.ticketStatus !== "closed",
    ).length;
    const activeMarkets = markets.filter(
      (m) => m.deletedAt === undefined && m.lifecycleStatus === "active",
    ).length;

    return {
      revenueToday,
      revenueTodayCount: todayPayments.length,
      currency: dominantCurrency,
      activeSubscriptions,
      newSignupsToday,
      openTickets,
      activeMarkets,
    };
  },
});