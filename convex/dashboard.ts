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

/**
 * Fresh-account launch checklist (data-driven): completed state is derived
 * from the tenant record, the verified email, plans, subscribers and team, so
 * the "A fresh start" surface reflects reality — never hardcoded values.
 */
export const getSetupStatus = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePermission(ctx, "dashboard:access");
    const tenantId = await requireTenantMember(ctx);
    const tenant = await ctx.db.get(tenantId);

    const [subscribers, plans, memberships] = await Promise.all([
      ctx.db
        .query("subscribers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
      ctx.db
        .query("plans")
        .filter((q) => q.eq(q.field("tenantId"), tenantId))
        .collect(),
      ctx.db
        .query("tenantMemberships")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
    ]);

    const currencySet =
      typeof tenant?.currency === "string" && tenant.currency.trim().length >= 3;
    const activePlans = plans.filter((plan) => plan.status === "active").length;
    const activeMembers = memberships.filter((membership) => membership.status === "active").length;

    const items = [
      {
        key: "workspace",
        label: "Name your account",
        href: "/settings",
        done: typeof tenant?.name === "string" && tenant.name.trim().length >= 2,
      },
      {
        key: "email",
        label: "Verify your email",
        href: "/account",
        done: user.emailVerificationTime !== undefined,
      },
      { key: "currency", label: "Choose your billing currency", href: "/settings", done: currencySet },
      { key: "plan", label: "Create your first plan", href: "/plans", done: activePlans > 0 },
      {
        key: "subscriber",
        label: "Add your first subscriber",
        href: "/subscribers",
        done: subscribers.some((sub) => sub.deletedAt === undefined),
      },
      {
        key: "teammate",
        label: "Invite your first teammate",
        href: "/teams",
        done: activeMembers > 1,
      },
    ];

    return {
      firstName: (user.name ?? "").trim().split(/\s+/)[0] ?? "",
      items,
      completedSteps: items.filter((item) => item.done).length,
      totalSteps: items.length,
    };
  },
});