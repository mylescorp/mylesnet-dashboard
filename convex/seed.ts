import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { mutation } from "./_generated/server";
import { logAudit } from "./lib/auditLog";

/**
 * Demo dataset for local operator-surface verification.
 *
 * A system-context development tool (mirrors `osMigrations`): resolves a
 * platform owner/admin as the creator, writes rows as direct `ctx.db.insert`
 * calls (no routed mutations — this never runs with an interactive identity),
 * and is idempotent via natural keys so re-runs are no-ops. It never deletes
 * or overwrites existing data.
 *
 * Run when deployment access is available:
 *   npx convex run seed:seedDemoData
 *
 * The seed intentionally leaves `tenantScope.tenantId` unset, matching the
 * current pre-backfill "legacy row" state of the additive tenant migration.
 */
const DAY = 24 * 60 * 60 * 1000;

const VOUCHER_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function computeChecksum(code: string): string {
  let sum = 0;
  for (let i = 0; i < code.length; i++) {
    sum = (sum * 31 + code.charCodeAt(i)) % 97;
  }
  return sum.toString().padStart(2, "0");
}

function voucherCode(): string {
  let code = "";
  for (let i = 0; i < 10; i++) {
    code += VOUCHER_CHARS[Math.floor(Math.random() * VOUCHER_CHARS.length)];
  }
  return code;
}

export const seedDemoData = mutation({
  args: {
    operatorUserId: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const nowMs = Date.now();

    const owner =
      args.operatorUserId !== undefined
        ? await ctx.db.get(args.operatorUserId)
        : await ctx.db
            .query("users")
            .filter((q) =>
              q.or(
                q.eq(q.field("platformRole"), "platform_owner"),
                q.eq(q.field("platformRole"), "platform_admin"),
              ),
            )
            .first();
    if (!owner) {
      throw new Error(
        "seedDemoData needs a platform owner/admin user (or pass operatorUserId)",
      );
    }

    const seeded: Record<string, number> = { markets: 0, plans: 0, agents: 0, subscribers: 0, payments: 0, invoices: 0, expenses: 0, batches: 0, vouchers: 0, tickets: 0 };

    // --- Markets -----------------------------------------------------------
    const marketDefs = [
      { name: "Kampala Demo", country: "UG", currency: "UGX", prefix: "KLA" as const },
      { name: "Nairobi Demo", country: "KE", currency: "KES", prefix: "NBO" as const },
    ];

    const marketIds = new Map<string, Id<"markets">>();
    for (const def of marketDefs) {
      const existing = await ctx.db
        .query("markets")
        .filter((q) => q.eq(q.field("name"), def.name))
        .first();
      if (existing) {
        marketIds.set(def.prefix, existing._id);
        continue;
      }
      const id = await ctx.db.insert("markets", {
        name: def.name,
        country: def.country,
        currency: def.currency,
        lifecycleStatus: "active",
        status: "active",
        createdAt: nowMs,
        updatedAt: nowMs,
      });
      marketIds.set(def.prefix, id);
      seeded.markets += 1;
    }

    // --- Plans per market ---------------------------------------------------
    const planDefs = [
      { codeSuffix: "DATA", name: "Data 10Mbps", category: "data" as const, price: 100, label: "Monthly" },
      { codeSuffix: "TV", name: "TV Package", category: "tv" as const, price: 90, label: "Monthly" },
      { codeSuffix: "HOME", name: "Home Bundle", category: "home_bundle" as const, price: 180, label: "Monthly" },
    ];
    const planIds = new Map<string, Id<"plans">>();
    for (const def of marketDefs) {
      const marketId = marketIds.get(def.prefix)!;
      const market = await ctx.db.get(marketId);
      for (const plan of planDefs) {
        const code = `${def.prefix}-${plan.codeSuffix}`;
        const existing = await ctx.db
          .query("plans")
          .withIndex("by_code", (q) => q.eq("code", code))
          .first();
        if (existing) {
          planIds.set(code, existing._id);
          continue;
        }
        const id = await ctx.db.insert("plans", {
          marketId,
          code,
          name: plan.name,
          category: plan.category,
          priceLocal: plan.price * (market?.currency === "KES" ? 7 : 1),
          currency: market?.currency ?? def.currency,
          durationLabel: plan.label,
          status: "active",
          createdBy: owner._id,
          createdAt: nowMs,
        });
        planIds.set(code, id);
        seeded.plans += 1;
      }
    }

    // --- Agents -------------------------------------------------------------
    const agentDefs = [
      { prefix: "KLA" as const, agents: [
        { name: "Amina Nakato", phone: "+256701234501" },
        { name: "Daniel Mukasa", phone: "+256712345602" },
      ] },
      { prefix: "NBO" as const, agents: [
        { name: "Grace Wanjiru", phone: "+254722123403" },
        { name: "Sam Otieno", phone: "+254733567804" },
      ] },
    ];
    const agentIds = new Map<string, Id<"agents">[]>();
    for (const group of agentDefs) {
      const list: Id<"agents">[] = [];
      for (const a of group.agents) {
      const existing = await ctx.db
        .query("agents")
        .filter((q) => q.eq(q.field("phone"), a.phone))
          .first();
        if (existing) {
          list.push(existing._id);
          continue;
        }
        const id = await ctx.db.insert("agents", {
          name: a.name,
          phone: a.phone,
          email: `${a.name.toLowerCase().replace(/\s+/g, ".")}@mylesnet.example`,
          lifecycleStatus: "active",
          status: "active",
          createdAt: nowMs,
          updatedAt: nowMs,
        });
        list.push(id);
        seeded.agents += 1;
      }
      agentIds.set(group.prefix, list);
    }

    // --- Subscribers ---------------------------------------------------------
    const subscriberDefs = [
      { market: "KLA" as const, account: "SKLA-1001", name: "Sarah Kintu", phone: "+256701100101", plan: "KLA-DATA", type: "pppoe" as const, status: "active" as const, expiry: 40 },
      { market: "KLA" as const, account: "SKLA-1002", name: "Joshua Ssemanda", phone: "+256702200102", plan: "KLA-TV", type: "hotspot" as const, status: "active" as const, expiry: 3 },
      { market: "KLA" as const, account: "SKLA-1003", name: "Patience Alinda", phone: "+256703300103", plan: "KLA-HOME", type: "pppoe" as const, status: "at_risk" as const, expiry: -6 },
      { market: "KLA" as const, account: "SKLA-1004", name: "Ivan Okello", phone: "+256704400104", plan: "KLA-DATA", type: "hotspot" as const, status: "expired" as const, expiry: -12 },
      { market: "NBO" as const, account: "SNBO-2001", name: "Mary Njeri", phone: "+254701200201", plan: "NBO-DATA", type: "pppoe" as const, status: "active" as const, expiry: 55 },
      { market: "NBO" as const, account: "SNBO-2002", name: "Brian Mwangi", phone: "+254702200202", plan: "NBO-HOME", type: "hotspot" as const, status: "active" as const, expiry: 5 },
      { market: "NBO" as const, account: "SNBO-2003", name: "Faith Nyambura", phone: "+254703300203", plan: "NBO-TV", type: "pppoe" as const, status: "at_risk" as const, expiry: -2 },
      { market: "NBO" as const, account: "SNBO-2004", name: "Kevin Ochieng", phone: "+254704400204", plan: "NBO-DATA", type: "hotspot" as const, status: "suspended" as const, expiry: -20 },
    ];

    const subscriberIds: Id<"subscribers">[] = [];
    for (const s of subscriberDefs) {
      const existing = await ctx.db
        .query("subscribers")
        .withIndex("by_account_number", (q) => q.eq("accountNumber", s.account))
        .first();
      if (existing) {
        subscriberIds.push(existing._id);
        continue;
      }
      const planId = planIds.get(s.plan);
      if (!planId) throw new Error(`Missing plan binding for ${s.plan}`);
      const plan = await ctx.db.get(planId);
      const id = await ctx.db.insert("subscribers", {
        accountNumber: s.account,
        name: s.name,
        phone: s.phone,
        email: `${s.name.toLowerCase().replace(/\s+/g, ".")}@example.com`,
        username: `${s.market.toLowerCase()}${s.account.slice(-4)}`,
        planId,
        connectionType: s.type,
        status: s.status,
        expiryDate: nowMs + s.expiry * DAY,
        walletBalance: s.status === "at_risk" ? 0 : 1500,
        currency: plan?.currency ?? (s.market === "KLA" ? "UGX" : "KES"),
        createdBy: owner._id,
        createdAt: nowMs - 40 * DAY,
        updatedAt: nowMs,
      });
      subscriberIds.push(id);
      seeded.subscribers += 1;
    }

    if (subscriberIds.length === 0) {
      throw new Error("seedDemoData needs at least one seeded subscriber");
    }

    // --- Payments -----------------------------------------------------------
    const paymentDefs = [
      { sub: 0, amount: 100000, gateway: "mobile_money", reference: "PAY-KLA-9001", status: "completed" as const },
      { sub: 1, amount: 90000, gateway: "cash", reference: "PAY-KLA-9002", status: "completed" as const },
      { sub: 2, amount: 180000, gateway: "mobile_money", reference: "PAY-KLA-9003", status: "pending" as const },
      { sub: 0, amount: 100000, gateway: "card", reference: "PAY-KLA-9004", status: "refunded" as const },
      { sub: 4, amount: 1400, gateway: "mobile_money", reference: "PAY-NBO-9101", status: "completed" as const },
    ];
    for (const p of paymentDefs) {
      const existing = await ctx.db
        .query("payments")
        .filter((q) => q.eq(q.field("reference"), p.reference))
        .first();
      if (existing) continue;
      const subscriber = await ctx.db.get(subscriberIds[p.sub]);
      await ctx.db.insert("payments", {
        subscriberId: subscriberIds[p.sub],
        amount: p.amount,
        currency: subscriber?.currency ?? "UGX",
        gateway: p.gateway,
        reference: p.reference,
        status: p.status,
        paymentDate: nowMs - 8 * DAY,
        operatorId: owner._id,
        createdAt: nowMs - 8 * DAY,
        updatedAt: nowMs - 8 * DAY,
      });
      seeded.payments += 1;
    }

    // --- Invoices -------------------------------------------------------------
    const invoiceDefs = [
      { sub: 0, number: "INV-2026-1001", status: "issued" as const, total: 100000, overdue: false },
      { sub: 1, number: "INV-2026-1002", status: "paid" as const, total: 90000, overdue: false },
      { sub: 2, number: "INV-2026-1003", status: "overdue" as const, total: 180000, overdue: true },
      { sub: 4, number: "INV-2026-1004", status: "draft" as const, total: 1400, overdue: false },
    ];
    for (const inv of invoiceDefs) {
      const existing = await ctx.db
        .query("invoices")
        .withIndex("by_number", (q) => q.eq("invoiceNumber", inv.number))
        .first();
      if (existing) continue;
      const subscriber = await ctx.db.get(subscriberIds[inv.sub]);
      await ctx.db.insert("invoices", {
        invoiceNumber: inv.number,
        subscriberId: subscriberIds[inv.sub],
        status: inv.status,
        currency: subscriber?.currency ?? "UGX",
        subtotal: inv.total,
        tax: 0,
        discount: 0,
        total: inv.total,
        dueDate: inv.overdue ? nowMs - 2 * DAY : nowMs + 10 * DAY,
        issuedDate: inv.status === "issued" || inv.status === "overdue" ? nowMs - 14 * DAY : undefined,
        paidDate: inv.status === "paid" ? nowMs - 5 * DAY : undefined,
        operatorId: owner._id,
        createdAt: nowMs - 20 * DAY,
        updatedAt: nowMs - 20 * DAY,
      });
      seeded.invoices += 1;
    }

    // --- Expenses ---------------------------------------------------------------
    const expenseDefs = [
      { market: "KLA" as const, category: "electricity" as const, amountLocal: 450000, currency: "UGX", amountUSD: 118, type: "fixed" as const },
      { market: "KLA" as const, category: "rent" as const, amountLocal: 600000, currency: "UGX", amountUSD: 158, type: "fixed" as const },
      { market: "KLA" as const, category: "maintenance" as const, amountLocal: 120000, currency: "UGX", amountUSD: 32, type: "variable" as const },
      { market: "NBO" as const, category: "airtel_data" as const, amountLocal: 35000, currency: "KES", amountUSD: 260, type: "variable" as const },
      { market: "NBO" as const, category: "salaries" as const, amountLocal: 68000, currency: "KES", amountUSD: 505, type: "fixed" as const },
    ];
    const month = new Date(nowMs).toISOString().slice(0, 7);
    for (const e of expenseDefs) {
      const marketId = marketIds.get(e.market)!;
      const existing = await ctx.db
        .query("expenses")
        .withIndex("by_market_month", (q) => q.eq("marketId", marketId).eq("month", month))
        .filter((q) => q.eq(q.field("category"), e.category))
        .first();
      if (existing) continue;
      await ctx.db.insert("expenses", {
        marketId,
        category: e.category,
        amountLocal: e.amountLocal,
        currency: e.currency,
        amountUSD: e.amountUSD,
        type: e.type,
        month,
        enteredBy: owner._id,
        enteredAt: nowMs - 3 * DAY,
        notes: "Demo seed expense",
      });
      seeded.expenses += 1;
    }

    // --- Voucher batches ---------------------------------------------------------
    const batchDefs = [
      { market: "KLA" as const, planType: "day" as const, qty: 10, price: 5000 },
      { market: "KLA" as const, planType: "month" as const, qty: 6, price: 80000 },
      { market: "NBO" as const, planType: "day" as const, qty: 8, price: 3000 },
    ];
    for (const b of batchDefs) {
      const marketId = marketIds.get(b.market)!;
      const market = await ctx.db.get(marketId);
      const existing = await ctx.db
        .query("voucherBatches")
        .withIndex("by_market", (q) => q.eq("marketId", marketId))
        .filter((q) => q.eq(q.field("planType"), b.planType))
        .first();
      if (existing) continue;
      const batchId = await ctx.db.insert("voucherBatches", {
        marketId,
        planType: b.planType,
        quantity: b.qty,
        currency: market?.currency ?? "UGX",
        priceEach: b.price,
        generatedBy: owner._id,
        createdAt: nowMs - 6 * DAY,
      });
      seeded.batches += 1;
      const expireWindow = b.planType === "day" ? 7 : 60;
      const marketAgents = agentIds.get(b.market) ?? [];
      for (let i = 0; i < b.qty; i++) {
        const code = voucherCode();
        await ctx.db.insert("vouchers", {
          batchId,
          marketId,
          code,
          checksum: computeChecksum(code),
          voucherStatus: i < b.qty / 2 ? "unallocated" : "owned",
          ownerAgentId: i < b.qty / 2 ? undefined : marketAgents[i % marketAgents.length],
          expiresAt: nowMs + expireWindow * DAY,
        });
        seeded.vouchers += 1;
      }
    }

    // --- Support tickets ------------------------------------------------------------
    const ticketDefs = [
      { subject: "Link down at Kampala demo south tower", description: "Subscribers report total outage since morning; tower reboots pending.", priority: "high" as const, status: "open" as const, market: "KLA" as const },
      { subject: "Hotspot voucher redemption failing for one customer", description: "Customer phone captured but session did not start.", priority: "medium" as const, status: "in_progress" as const, market: "KLA" as const },
      { subject: "Request to provision extra bandwidth for home bundle", description: "Bundle lookup mismatch on two accounts.", priority: "low" as const, status: "waiting_on_customer" as const, market: "NBO" as const },
    ];
    for (const t of ticketDefs) {
      const marketId = marketIds.get(t.market)!;
      const existing = await ctx.db
        .query("supportTickets")
        .withIndex("by_market", (q) => q.eq("marketId", marketId))
        .filter((q) => q.eq(q.field("subject"), t.subject))
        .first();
      if (existing) continue;
      await ctx.db.insert("supportTickets", {
        subject: t.subject,
        description: t.description,
        ticketStatus: t.status,
        priority: t.priority,
        marketId,
        createdBy: owner._id,
        createdAt: nowMs - 2 * DAY,
        updatedAt: nowMs - 1 * DAY,
      });
      seeded.tickets += 1;
    }

    await logAudit(ctx, {
      action: "seed.demo",
      entityTable: "markets",
      entityId: marketIds.get("KLA")!,
      changedBy: owner._id,
      after: seeded,
    });

    return seeded;
  },
});
