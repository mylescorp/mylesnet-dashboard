import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";
import type { Id } from "./_generated/dataModel";

/**
 * Rich operations overview for the network dashboard — one query that
 * aggregates the current live state across all routers, access points, and
 * hotspot sessions.
 */
export const getOverview = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);

    const routers = await ctx.db.query("routers").collect();

    const routerEntries = [];
    let totalUsers = 0;
    let activeAccessPoints = 0;
    let totalAccessPoints = 0;
    let totalDailyBytes = 0;
    let cpuSum = 0;
    let cpuCount = 0;
    let lastObservedAt: number | null = null;

    for (const router of routers) {
      const accessPoints = await ctx.db
        .query("accessPoints")
        .withIndex("by_router", (q) => q.eq("routerId", router._id))
        .collect();

      const apEntries = [];
      for (const accessPoint of accessPoints) {
        totalAccessPoints++;
        const health = await ctx.db
          .query("accessPointSamples")
          .withIndex("by_access_point_timestamp", (q) =>
            q.eq("accessPointId", accessPoint._id)
          )
          .order("desc")
          .first();

        const sessions = await ctx.db
          .query("activeHotspotSessions")
          .withIndex("by_access_point", (q) => q.eq("accessPointId", accessPoint._id))
          .collect();
        const activeUserCount = sessions.length;

        const trafficSamples = await ctx.db
          .query("healthSamples")
          .withIndex("by_router_timestamp", (q) =>
            q.eq("routerId", router._id)
          )
          .order("desc")
          .take(24);

        const dailyBytes = await ctx.db
          .query("usageSamples")
          .withIndex("by_access_point_timestamp", (q) =>
            q.eq("accessPointId", accessPoint._id)
          )
          .collect();

        const dailyBytesTotal = dailyBytes
          .filter((s) => s.timestamp >= Date.now() - 24 * 60 * 60 * 1000)
          .reduce((sum: number, s) => sum + s.byteDelta, 0);

        totalUsers += activeUserCount;
        totalDailyBytes += dailyBytesTotal;

        if (health) {
          cpuSum += health.queueDrops > 0 ? 1 : 0;
          cpuCount++;
        }

        const trafficTrend = trafficSamples.slice(0, 24).map((sample) => ({
          timestamp: sample.timestamp,
          bytesPerSecond: sample.rxBytesPerSec + sample.txBytesPerSec,
        }));

        apEntries.push({
          accessPoint,
          health,
          activeUserCount,
          dailyBytes: dailyBytesTotal,
          trafficTrend,
        });

        if (health?.linkState) activeAccessPoints++;
      }

      const configSnapshot = await ctx.db
        .query("routerConfigurationSnapshots")
        .withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id))
        .order("desc")
        .first();

      const upstreamConfigured =
        !!configSnapshot?.snapshotJson &&
        configSnapshot.snapshotJson.includes("default route") ||
        false;

      if (lastObservedAt === null || (configSnapshot?.observedAt ?? 0) > lastObservedAt) {
        lastObservedAt = configSnapshot?.observedAt ?? null;
      }

      routerEntries.push({
        router,
        accessPoints: apEntries,
        upstream: { configured: upstreamConfigured },
      });
    }

    const averageCpu = cpuCount > 0 ? (cpuSum / cpuCount) * 100 : null;
    const healthScore =
      totalAccessPoints === 0
        ? null
        : Math.round((activeAccessPoints / totalAccessPoints) * 100);

    const metrics = {
      collectorConnected: lastObservedAt !== null,
      lastObservedAt,
      healthScore,
      totalUsers,
      activeAccessPoints,
      totalAccessPoints,
      totalDailyBytes,
      averageCpu,
    };

    return { metrics, routers: routerEntries };
  },
});

/** Live hotspot sessions mapped to a specific access point. */
export const getAccessPointUsers = query({
  args: { accessPointId: v.id("accessPoints") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return await ctx.db
      .query("activeHotspotSessions")
      .withIndex("by_access_point", (q) => q.eq("accessPointId", args.accessPointId))
      .collect();
  },
});

/**
 * Centipid CSV reconciliation — weekly cron. Matches redemption phone
 * numbers against Centipid's export and writes renewal credits back to the
 * acquiring agent RETROACTIVELY (not real-time).
 *
 * NOTE: This depends on the CSV export containing a customer phone number
 * or matching identifier (Section 4.7). If verification hasn't happened,
 * this runs silently with zero matches — no wrong numbers are ever shown.
 * Agent-level renewal credit shows "unavailable — pending Centipid data"
 * wherever the UI would otherwise show it.
 *
 * The actual Centipid API/CSV fetch lives in a server-side scheduled action
 * that calls this mutation with the parsed export. This mutation accepts a
 * batch of parsed rows and writes them.
 */
export const centipidCsvReconcile = mutation({
  args: {
    csvRows: v.optional(
      v.array(
        v.object({
          customerPhone: v.string(),
          renewalType: v.string(),
          renewalAmount: v.number(),
          currency: v.union(v.literal("UGX"), v.literal("KSH")),
          marketName: v.optional(v.string()),
          centipidMatchRef: v.optional(v.string()),
        })
      )
    ),
  },
  handler: async (ctx, args) => {
    const rows = args.csvRows ?? [];

    if (rows.length === 0) {
      return {
        processed: false,
        reason: "no_csv_data",
        note: "Centipid CSV export not verified or unavailable — renewal attribution pending.",
      };
    }

    const batchId = `csv-${Date.now()}`;
    let written = 0;
    const currencies = new Set<"UGX" | "KSH">();

    for (const row of rows) {
      const currency = row.currency;
      if (currency === "UGX" || currency === "KSH") currencies.add(currency);

      const voucher = await ctx.db
        .query("vouchers")
        .withIndex("by_status", (q) => q.eq("voucherStatus", "redeemed"))
        .filter((q) => q.eq(q.field("customerPhoneAtRedemption"), row.customerPhone))
        .first();

      if (!voucher || !voucher.ownerAgentId) continue;

      const existing = await ctx.db
        .query("renewalCredits")
        .withIndex("by_phone", (q) => q.eq("customerPhone", row.customerPhone))
        .filter((q) => q.eq(q.field("renewalType"), row.renewalType))
        .first();

      if (existing) continue;

      const market = await ctx.db.get(voucher.marketId);
      const effectiveCurrency: "UGX" | "KSH" = market?.currency ?? currency;

      await ctx.db.insert("renewalCredits", {
        agentId: voucher.ownerAgentId,
        marketId: voucher.marketId,
        customerPhone: row.customerPhone,
        initialVoucherId: voucher._id,
        renewalType: row.renewalType,
        renewalAmount: row.renewalAmount,
        currency: effectiveCurrency,
        centipidMatchRef: row.centipidMatchRef,
        creditedAt: Date.now(),
        reconciliationBatchId: batchId,
      });
      written++;
    }

    return {
      processed: true,
      batchId,
      written,
      total: rows.length,
    };
  },
});

export const computeLeaderboardDaily = mutation({
  args: {},
  handler: async (ctx) => {
    const snapshotDate = new Date().toISOString().slice(0, 10);

    const agents = await ctx.db
      .query("agents")
      .filter((q) =>
        q.and(
          q.eq(q.field("lifecycleStatus"), "active"),
          q.neq(q.field("status"), "deleted")
        )
      )
      .collect();

    const rankings: Array<{
      agentId: Id<"agents">;
      totalSalesVolume: number;
      totalSalesCount: number;
      renewalCount: number;
      renewalRateAvailable: boolean;
      renewalRate: number | undefined;
      totalCommissionEarned: number;
      currency: "UGX" | "KSH";
    }> = [];

    for (const agent of agents) {
      const vouchers = await ctx.db
        .query("vouchers")
        .withIndex("by_owner", (q) => q.eq("ownerAgentId", agent._id))
        .collect();

      const soldVouchers = vouchers.filter(
        (vv) => vv.voucherStatus === "sold" || vv.voucherStatus === "redeemed"
      );

      const marketForCurrency = soldVouchers[0]?.marketId
        ? await ctx.db.get(soldVouchers[0].marketId)
        : null;
      const currency: "UGX" | "KSH" = marketForCurrency?.currency ?? "UGX";

      const commissions = await ctx.db
        .query("commissions")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();

      const renewals = await ctx.db
        .query("renewalCredits")
        .withIndex("by_agent", (q) => q.eq("agentId", agent._id))
        .collect();

      const hasRenewalData = renewals.length > 0;
      const renewalRate = hasRenewalData && soldVouchers.length > 0
        ? renewals.length / soldVouchers.length
        : undefined;

      rankings.push({
        agentId: agent._id,
        totalSalesVolume: soldVouchers.length,
        totalSalesCount: soldVouchers.length,
        renewalCount: renewals.length,
        renewalRateAvailable: hasRenewalData,
        renewalRate,
        totalCommissionEarned: commissions.reduce((sum, c) => sum + c.amount, 0),
        currency,
      });
    }

    rankings.sort(
      (a, b) => Number(b.totalSalesVolume) - Number(a.totalSalesVolume)
    );

    const now = Date.now();
    for (let i = 0; i < rankings.length; i++) {
      const r = rankings[i];
      await ctx.db.insert("leaderboardSnapshots", {
        snapshotDate,
        agentId: r.agentId,
        totalSalesVolume: r.totalSalesVolume,
        totalSalesCount: r.totalSalesCount,
        renewalCount: r.renewalCount,
        renewalRateAvailable: r.renewalRateAvailable,
        renewalRate: r.renewalRate,
        totalCommissionEarned: r.totalCommissionEarned,
        currency: r.currency,
        rank: i + 1,
        createdAt: now,
      });
    }

    return { agentCount: rankings.length, snapshotDate };
  },
});

/**
 * Monthly operating cost reminder — `crons.monthly` on day 1. Flags any
 * active market that has no cost entry for the current month. The dashboard
 * surfaces these as action items; this job ensures the data is recomputed.
 */
export const runMonthlyCostReminder = mutation({
  args: {},
  handler: async (ctx) => {
    const now = new Date();
    const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const activeMarkets = await ctx.db
      .query("markets")
      .filter((q) =>
        q.and(
          q.eq(q.field("lifecycleStatus"), "active"),
          q.neq(q.field("status"), "deleted")
        )
      )
      .collect();

    const missing = [];
    for (const market of activeMarkets) {
      const entry = await ctx.db
        .query("marketOperatingCosts")
        .withIndex("by_market_month", (q) =>
          q.eq("marketId", market._id).eq("yearMonth", yearMonth)
        )
        .first();
      if (!entry) {
        missing.push({ marketId: market._id, name: market.name });
      }
    }

    return { yearMonth, missingCount: missing.length, marketCount: activeMarkets.length };
  },
});

/**
 * Support ticket SLA check — `crons.daily`. Flags tickets stuck in "open"
 * beyond the SLA window (48 hours) or "in_progress" beyond 5 business days.
 * Returns counts; the dashboard/tickets page can surface these.
 */
export const checkTicketSla = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const OPEN_SLA_MS = 48 * 60 * 60 * 1000;
    const IN_PROGRESS_SLA_MS = 5 * 24 * 60 * 60 * 1000;

    const openTickets = await ctx.db
      .query("supportTickets")
      .filter((q) => q.eq(q.field("ticketStatus"), "open"))
      .collect();

    const breachedOpen = openTickets.filter((t) => now - t.createdAt > OPEN_SLA_MS);

    const inProgressTickets = await ctx.db
      .query("supportTickets")
      .filter((q) => q.eq(q.field("ticketStatus"), "in_progress"))
      .collect();

    const breachedInProgress = inProgressTickets.filter(
      (t) => now - t.createdAt > IN_PROGRESS_SLA_MS
    );

    return {
      openBreached: breachedOpen.length,
      inProgressBreached: breachedInProgress.length,
    };
  },
});

/**
 * PII retention purge — `crons.daily`. Clears customerPhoneAtRedemption on
 * vouchers redeem more than 12 months ago, satisfying the Kenya DPA 2019
 * purpose-limitation + retention-limits principle. Financial/audit records
 * are preserved.
 */
export const purgeExpiredPii = mutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const RETENTION_MS = 12 * 30 * 24 * 60 * 60 * 1000;

    const candidates = await ctx.db
      .query("vouchers")
      .withIndex("by_status", (q) => q.eq("voucherStatus", "redeemed"))
      .collect();

    let purged = 0;
    for (const voucher of candidates) {
      if (
        voucher.customerPhoneAtRedemption &&
        voucher.redeemedAt &&
        now - voucher.redeemedAt > RETENTION_MS
      ) {
        await ctx.db.patch(voucher._id, {
          customerPhoneAtRedemption: undefined,
        });
        purged++;
      }
    }

    return { purged };
  },
});
