import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { requireTenantMember } from "./lib/tenant";
import type { Doc, Id } from "./_generated/dataModel";

const DAY_MS = 86_400_000;

function inServiceWindow(sub: Doc<"subscribers">, now: number): boolean {
  if (sub.deletedAt !== undefined) return false;
  if (sub.status !== "active") return false;
  if (sub.expiryDate !== undefined && sub.expiryDate <= now) return false;
  return true;
}

export const listLiveSessions = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "dashboard:access");
    const tenantId = await requireTenantMember(ctx);

    const [subscribers, allPlans] = await Promise.all([
      ctx.db
        .query("subscribers")
        .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
        .collect(),
      ctx.db.query("plans").collect(),
    ]);

    const plans = new Map<Id<"plans">, Doc<"plans">>();
    for (const plan of allPlans) {
      if (plan.tenantId === tenantId) plans.set(plan._id, plan);
    }

    const now = Date.now();
    const live = subscribers.filter((s) => inServiceWindow(s, now));

    const sessions = live.map((s) => {
      const plan = s.planId ? plans.get(s.planId) : undefined;
      return {
        id: s._id,
        accountNumber: s.accountNumber,
        name: s.name,
        username: s.username ?? null,
        phone: s.phone,
        ipAddress: s.ipAddress ?? null,
        macAddress: s.macAddress ?? null,
        connectionType: s.connectionType,
        currency: s.currency,
        walletBalance: s.walletBalance,
        plan:
          plan && plan.status === "active"
            ? {
                name: plan.name,
                category: plan.category,
                priceLocal: plan.priceLocal,
                currency: plan.currency,
              }
            : null,
        expiryDate: s.expiryDate ?? null,
        daysRemaining:
          s.expiryDate === undefined
            ? null
            : Math.max(0, Math.ceil((s.expiryDate - now) / DAY_MS)),
        lastSeen: s.updatedAt,
      };
    });

    sessions.sort((a, b) => (b.lastSeen ?? 0) - (a.lastSeen ?? 0));

    const byConnectionType = {
      pppoe: sessions.filter((s) => s.connectionType === "pppoe").length,
      hotspot: sessions.filter((s) => s.connectionType === "hotspot").length,
    };
    const atRiskSoon = sessions.filter(
      (s) => s.daysRemaining !== null && s.daysRemaining <= 7,
    ).length;

    return { sessions, stats: { totalLive: sessions.length, byConnectionType, atRiskSoon } };
  },
});

export const listSites = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "dashboard:access");
    const tenantId = await requireTenantMember(ctx);

    const [markets, plans, subscribers, payments, tickets, expenses] =
      await Promise.all([
        ctx.db.query("markets").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        ctx.db.query("plans").collect(),
        ctx.db.query("subscribers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        ctx.db.query("supportTickets").filter((q) => q.eq(q.field("tenantId"), tenantId)).collect(),
        ctx.db.query("expenses").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      ]);

    const planByMarket = new Map<Id<"markets">, Doc<"plans">[]>();
    for (const plan of plans) {
      if (plan.tenantId !== tenantId || plan.status !== "active" || !plan.marketId) continue;
      const list = planByMarket.get(plan.marketId) ?? [];
      list.push(plan);
      planByMarket.set(plan.marketId, list);
    }

    const marketBySubscriber = new Map<Id<"subscribers">, Id<"markets">>();
    for (const sub of subscribers) {
      if (!sub.planId) continue;
      const target = plans.find((p) => p._id === sub.planId && p.tenantId === tenantId);
      if (target?.marketId) marketBySubscriber.set(sub._id, target.marketId);
    }
    const isSubscriberOf = (subId: Id<"subscribers">, marketId: Id<"markets">) =>
      marketBySubscriber.get(subId) === marketId;
    const planBelongsTo = (planId: Id<"plans">, marketId: Id<"markets">) =>
      planByMarket.get(marketId)?.some((p) => p._id === planId) ?? false;

    const now = Date.now();

    const sites = markets
      .filter((m) => m.deletedAt === undefined)
      .map((m) => {
        const sitePlans = planByMarket.get(m._id) ?? [];
        const siteSubscribers = subscribers.filter((s) =>
          s.planId ? planBelongsTo(s.planId, m._id) : false,
        );
        const activeClients = new Set(
          siteSubscribers.filter((s) => inServiceWindow(s, now)).map((s) => s._id),
        );
        let revenue = 0;
        let revenue30d = 0;
        const thirtyDays = now - 30 * DAY_MS;
        for (const p of payments) {
          if (p.status !== "completed") continue;
          const belongs =
            (p.planId ? planBelongsTo(p.planId, m._id) : false) ||
            (p.subscriberId ? isSubscriberOf(p.subscriberId, m._id) : false);
          if (!belongs) continue;
          revenue += p.amount;
          if (p.paymentDate >= thirtyDays) revenue30d += p.amount;
        }
        const openTickets = tickets.filter(
          (t) => t.marketId === m._id && t.deletedAt === undefined && t.ticketStatus !== "closed",
        ).length;
        const expenseTotal = expenses
          .filter((e) => e.marketId === m._id)
          .reduce((sum, e) => sum + e.amountLocal, 0);

        return {
          id: m._id,
          name: m.name,
          country: m.country,
          currency: m.currency,
          lifecycleStatus: m.lifecycleStatus,
          status: m.status,
          coordinates: m.coordinates ?? null,
          installDate: m.installDate ?? null,
          airtelPlanMbps: m.airtelPlanMbps ?? null,
          createdAt: m.createdAt,
          planCount: sitePlans.length,
          clientCount: siteSubscribers.length,
          activeClientCount: activeClients.size,
          revenue,
          revenue30d,
          openTickets,
          expenseTotal,
        };
      });

    sites.sort((a, b) => a.name.localeCompare(b.name));
    return sites;
  },
});

export const getSiteDetail = query({
  args: { siteId: v.id("markets") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "dashboard:access");
    const tenantId = await requireTenantMember(ctx);

    const market = await ctx.db.get(args.siteId);
    if (!market || market.deletedAt !== undefined) return null;
    if (market.tenantId !== tenantId) {
      throw new Error("Unauthorized: site belongs to another tenant");
    }

    const [sitePlans, allSubscribers, allPlans, allPayments, allInvoices, tickets, expenses, auditRows] =
      await Promise.all([
        ctx.db.query("plans").collect(),
        ctx.db.query("subscribers").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        ctx.db.query("plans").collect(),
        ctx.db.query("payments").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        ctx.db.query("invoices").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        ctx.db.query("supportTickets").withIndex("by_market", (q) => q.eq("marketId", args.siteId)).collect(),
        ctx.db.query("expenses").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
        ctx.db.query("auditLog")
          .filter((q) =>
            q.and(
              q.eq(q.field("entityTable"), "markets"),
              q.eq(q.field("entityId"), args.siteId),
            ),
          )
          .order("desc")
          .limit(30)
          .collect(),
      ]);

    const plans = sitePlans.filter(
      (p) => p.tenantId === tenantId && p.status === "active" && p.marketId === args.siteId,
    );
    const planById = new Map<Id<"plans">, Doc<"plans">>();
    for (const p of allPlans) {
      if (p.tenantId === tenantId) planById.set(p._id, p);
    }
    const planBelongs = (planId: Id<"plans">) => plans.some((p) => p._id === planId);
    const clientOfSite = (subId: Id<"subscribers">) => {
      const sub = allSubscribers.find((s) => s._id === subId);
      return sub?.planId ? planBelongs(sub.planId) : false;
    };

    const clients = allSubscribers.filter((s) =>
      s.planId ? planBelongs(s.planId) : false,
    );
    const now = Date.now();
    const activeClients = clients.filter((s) => inServiceWindow(s, now));

    const payments = allPayments
      .filter(
        (p) =>
          (p.planId ? planBelongs(p.planId) : false) ||
          (p.subscriberId ? clientOfSite(p.subscriberId) : false),
      )
      .sort((a, b) => b.paymentDate - a.paymentDate)
      .slice(0, 30);

    const invoices = allInvoices
      .filter((i) => (i.subscriberId ? clientOfSite(i.subscriberId) : false))
      .sort((a, b) => b.createdAt - a.createdAt)
      .slice(0, 30);

    const siteExpenses = expenses
      .filter((e) => e.marketId === args.siteId)
      .sort((a, b) => (a.month < b.month ? 1 : -1));

    const revenue = allPayments
      .filter((p) => p.status === "completed")
      .filter(
        (p) =>
          (p.planId ? planBelongs(p.planId) : false) ||
          (p.subscriberId ? clientOfSite(p.subscriberId) : false),
      )
      .reduce((sum, p) => sum + p.amount, 0);

    return {
      site: {
        id: market._id,
        name: market.name,
        country: market.country,
        currency: market.currency,
        lifecycleStatus: market.lifecycleStatus,
        status: market.status,
        createdAt: market.createdAt,
        updatedAt: market.updatedAt,
        coordinates: market.coordinates ?? null,
        installDate: market.installDate ?? null,
        airtelPlanMbps: market.airtelPlanMbps ?? null,
        notes: market.notes ?? null,
      },
      summary: {
        planCount: plans.length,
        clientCount: clients.length,
        activeClientCount: activeClients.length,
        revenue,
      },
      plans: plans.map((p) => ({
        id: p._id,
        code: p.code,
        name: p.name,
        category: p.category,
        priceLocal: p.priceLocal,
        currency: p.currency,
        durationLabel: p.durationLabel ?? null,
      })),
      clients: clients.map((c) => {
        const plan = c.planId ? planById.get(c.planId) : undefined;
        return {
          id: c._id,
          accountNumber: c.accountNumber,
          name: c.name,
          username: c.username ?? null,
          phone: c.phone,
          ipAddress: c.ipAddress ?? null,
          macAddress: c.macAddress ?? null,
          connectionType: c.connectionType,
          status: c.status,
          currency: c.currency,
          walletBalance: c.walletBalance,
          expiryDate: c.expiryDate ?? null,
          isLive: inServiceWindow(c, now),
          daysRemaining:
            c.expiryDate === undefined
              ? null
              : Math.max(0, Math.ceil((c.expiryDate - now) / DAY_MS)),
          planName: plan?.name ?? null,
          planCategory: plan?.category ?? null,
        };
      }),
      payments: payments.map((p) => ({
        id: p._id,
        amount: p.amount,
        currency: p.currency,
        gateway: p.gateway,
        reference: p.reference,
        status: p.status,
        paymentDate: p.paymentDate,
        idSuffix: (p.subscriberId?.slice(-6) ?? p.invoiceId?.slice(-6) ?? p.planId?.slice(-6) ?? null) as string | null,
      })),
      invoices: invoices.map((i) => ({
        id: i._id,
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        currency: i.currency,
        total: i.total,
        subtotal: i.subtotal,
        tax: i.tax,
        discount: i.discount,
        dueDate: i.dueDate ?? null,
        paidDate: i.paidDate ?? null,
        createdAt: i.createdAt,
      })),
      tickets: tickets
        .filter((t) => t.deletedAt === undefined)
        .map((t) => ({
          id: t._id,
          subject: t.subject,
          status: t.ticketStatus,
          priority: t.priority,
          createdAt: t.createdAt,
        }))
        .sort((a, b) => b.createdAt - a.createdAt),
      expenses: siteExpenses.map((e) => ({
        id: e._id,
        category: e.category,
        amountLocal: e.amountLocal,
        amountUSD: e.amountUSD,
        currency: e.currency,
        type: e.type,
        month: e.month,
        enteredAt: e.enteredAt,
      })),
      audit: auditRows.map((a) => ({
        id: a._id,
        action: a.action,
        entityTable: a.entityTable,
        entityId: a.entityId,
        beforeJson: a.beforeJson ?? null,
        afterJson: a.afterJson ?? null,
        timestamp: a.timestamp,
        changedBy: a.changedBy,
      })),
    };
  },
});