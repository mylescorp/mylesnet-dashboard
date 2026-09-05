import { v } from "convex/values";
import { internalMutation, query, type QueryCtx } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";
import type { Doc, Id } from "./_generated/dataModel";

const DAY_MS = 24 * 60 * 60 * 1000;
const COLLECTOR_FRESHNESS_MS = 60_000;

function activeRouters(routers: Doc<"routers">[]): Doc<"routers">[] {
  return routers.filter((router) => router.archivedAt === undefined);
}

async function dailyBytesForAccessPoint(ctx: Pick<QueryCtx, "db">, accessPointId: Id<"accessPoints">): Promise<number> {
  const cutoff = Date.now() - DAY_MS;
  const samples = await ctx.db
    .query("usageSamples")
    .withIndex("by_access_point_timestamp", (q) => q.eq("accessPointId", accessPointId))
    .filter((q) => q.gte(q.field("timestamp"), cutoff))
    .collect();
  return samples.reduce((sum, sample) => sum + sample.byteDelta, 0);
}

async function accessPointLiveSummary(ctx: Pick<QueryCtx, "db">, accessPoint: Doc<"accessPoints">, routerId: Id<"routers">) {
  const health = await ctx.db
    .query("accessPointSamples")
    .withIndex("by_access_point_timestamp", (q) => q.eq("accessPointId", accessPoint._id))
    .order("desc")
    .first();

  const sessions = await ctx.db
    .query("activeHotspotSessions")
    .withIndex("by_access_point", (q) => q.eq("accessPointId", accessPoint._id))
    .collect();
  const activeUserCount = sessions.length;

  const trafficSamples = await ctx.db
    .query("healthSamples")
    .withIndex("by_router_timestamp", (q) => q.eq("routerId", routerId))
    .order("desc")
    .take(24);

  const trafficTrend = trafficSamples.slice(0, 24).map((sample) => ({
    timestamp: sample.timestamp,
    bytesPerSecond: sample.rxBytesPerSec + sample.txBytesPerSec,
  }));

  return {
    accessPoint,
    health,
    activeUserCount,
    dailyBytes: await dailyBytesForAccessPoint(ctx, accessPoint._id),
    trafficTrend,
  };
}

async function collectorStatusForRouter(ctx: Pick<QueryCtx, "db">, routerId: Id<"routers">) {
  return ctx.db
    .query("collectorRuns")
    .withIndex("by_router_observedAt", (q) => q.eq("routerId", routerId))
    .order("desc")
    .first();
}

/**
 * Lean KPI strip — cheap aggregates across the estate for the dashboard header.
 * Subscribes independently so the header stays responsive while cards load.
 */
export const getKpis = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const routers = activeRouters(await ctx.db.query("routers").collect());

    let totalUsers = 0;
    let activeAccessPoints = 0;
    let totalAccessPoints = 0;
    let totalDailyBytes = 0;
    let cpuSum = 0;
    let cpuCount = 0;
    let lastObservedAt: number | null = null;
    let latestCollectorStatus: "connected" | "failed" | null = null;
    let latestCollectorStatusMessage: string | null = null;
    let latestCollectorStatusAt = 0;

    for (const router of routers) {
      const latestCollectorRun = await collectorStatusForRouter(ctx, router._id);
      const latestRouterSample = await ctx.db
        .query("healthSamples")
        .withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id))
        .order("desc")
        .first();
      const configSnapshot = await ctx.db
        .query("routerConfigurationSnapshots")
        .withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id))
        .order("desc")
        .first();
      if (latestCollectorRun && latestCollectorRun.observedAt >= latestCollectorStatusAt) {
        latestCollectorStatusAt = latestCollectorRun.observedAt;
        latestCollectorStatus = latestCollectorRun.status;
        latestCollectorStatusMessage = latestCollectorRun.message ?? null;
      }
      const latestObservation = Math.max(
        latestCollectorRun?.observedAt ?? 0,
        latestRouterSample?.timestamp ?? 0,
        configSnapshot?.observedAt ?? 0,
      );
      if (latestObservation > 0 && (lastObservedAt === null || latestObservation > lastObservedAt)) {
        lastObservedAt = latestObservation;
      }

      const accessPoints = (await ctx.db
        .query("accessPoints")
        .withIndex("by_router", (q) => q.eq("routerId", router._id))
        .collect()).filter((accessPoint) => accessPoint.archivedAt === undefined);

      for (const accessPoint of accessPoints) {
        totalAccessPoints++;
        const summary = await accessPointLiveSummary(ctx, accessPoint, router._id);
        totalUsers += summary.activeUserCount;
        totalDailyBytes += summary.dailyBytes;
        if (summary.health) {
          cpuSum += summary.health.queueDrops > 0 ? 1 : 0;
          cpuCount++;
        }
        if (summary.health?.linkState) activeAccessPoints++;
      }
    }

    const averageCpu = cpuCount > 0 ? (cpuSum / cpuCount) * 100 : null;
    return {
      collectorConnected:
        latestCollectorStatus === "connected" && Date.now() - latestCollectorStatusAt < COLLECTOR_FRESHNESS_MS,
      lastObservedAt,
      collectorStatus: latestCollectorStatus,
      collectorStatusMessage: latestCollectorStatusMessage,
      healthScore: totalAccessPoints === 0 ? null : Math.round((activeAccessPoints / totalAccessPoints) * 100),
      totalUsers,
      activeAccessPoints,
      totalAccessPoints,
      totalDailyBytes,
      averageCpu,
    };
  },
});

/** Router select list for filters — cheap and subscribes rarely. */
export const getRouterSummaries = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    return activeRouters(await ctx.db.query("routers").collect()).map((router) => ({
      _id: router._id,
      name: router.name,
      location: router.location,
    }));
  },
});

/**
 * Live per-router subscription — one router with its access point cards, upstream
 * observation, collector health, and telemetry summary.
 */
export const getLiveRouter = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) return null;

    const accessPoints = (await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", router._id))
      .collect()).filter((accessPoint) => accessPoint.archivedAt === undefined);

    const apEntries = [];
    for (const accessPoint of accessPoints) {
      apEntries.push(await accessPointLiveSummary(ctx, accessPoint, router._id));
    }

    const configSnapshot = await ctx.db
      .query("routerConfigurationSnapshots")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id))
      .order("desc")
      .first();

    let upstreamConfigured = false;
    if (configSnapshot?.snapshotJson) {
      if (configSnapshot.snapshotJson.includes("\"dst-address\":\"0.0.0.0/0\"")) {
        upstreamConfigured = true;
      } else {
        try {
          const config: { routes?: Array<{ "dst-address"?: string }> } = JSON.parse(configSnapshot.snapshotJson);
          upstreamConfigured = (config.routes ?? []).some((route) =>
            route["dst-address"] === "0.0.0.0/0" || route["dst-address"] === "::/0",
          );
        } catch {
          upstreamConfigured = configSnapshot.snapshotJson.includes("default route");
        }
      }
    }

    const collector = await collectorStatusForRouter(ctx, router._id);
    const telemetry = await ctx.db
      .query("routerTelemetry")
      .withIndex("by_router", (q) => q.eq("routerId", router._id))
      .first();

    return {
      router,
      accessPoints: apEntries,
      upstream: { configured: upstreamConfigured },
      collector,
      telemetry: telemetry ?? null,
    };
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

/** Live detail for a single access point card — latest sample, users, 24h bytes. */
export const getAccessPointLive = query({
  args: { accessPointId: v.id("accessPoints") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const accessPoint = await ctx.db.get(args.accessPointId);
    if (!accessPoint || accessPoint.archivedAt !== undefined) return null;
    return accessPointLiveSummary(ctx, accessPoint, accessPoint.routerId);
  },
});

/** Current DHCP leases synced by the collector for a router. */
export const getDhcpLeases = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return ctx.db
      .query("dhcpLeases")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();
  },
});

/** DHCP pool usage derived from the latest collector configuration snapshot. */
export const getDhcpPoolOverview = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const snapshot = await ctx.db
      .query("routerConfigurationSnapshots")
      .withIndex("by_router_timestamp", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .first();
    const leases = await ctx.db
      .query("dhcpLeases")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();

    const capacityOf = (ranges: string): number => {
      if (!ranges) return 0;
      let total = 0;
      for (const range of ranges.split(",")) {
        const [start, end] = range.split("-").map((part) => part.trim());
        if (!start || !end) continue;
        const startParts = start.split(".").map(Number);
        const endParts = end.split(".").map(Number);
        if (startParts.length !== 4 || endParts.length !== 4) continue;
        if (startParts.some(Number.isNaN) || endParts.some(Number.isNaN)) continue;
        const startInt = ((startParts[0] << 24) | (startParts[1] << 16) | (startParts[2] << 8) | startParts[3]) >>> 0;
        const endInt = ((endParts[0] << 24) | (endParts[1] << 16) | (endParts[2] << 8) | endParts[3]) >>> 0;
        if (endInt < startInt) continue;
        total += endInt - startInt + 1;
      }
      return total;
    };

    const inRanges = (ip: string, ranges: string): boolean => {
      const address = ip.split(".").map(Number);
      if (address.length !== 4 || address.some(Number.isNaN)) return false;
      const addressInt = ((address[0] << 24) | (address[1] << 16) | (address[2] << 8) | address[3]) >>> 0;
      for (const range of ranges.split(",")) {
        const [start, end] = range.split("-").map((part) => part.trim());
        const startParts = start?.split(".").map(Number) ?? [];
        const endParts = end?.split(".").map(Number) ?? [];
        if (startParts.length !== 4 || endParts.length !== 4) continue;
        if (startParts.some(Number.isNaN) || endParts.some(Number.isNaN)) continue;
        const startInt = ((startParts[0] << 24) | (startParts[1] << 16) | (startParts[2] << 8) | startParts[3]) >>> 0;
        const endInt = ((endParts[0] << 24) | (endParts[1] << 16) | (endParts[2] << 8) | endParts[3]) >>> 0;
        if (addressInt >= startInt && addressInt <= endInt) return true;
      }
      return false;
    };

    let pools: Array<{ name?: string; ranges?: string; capacity: number; used: number; utilization: number }> = [];
    if (snapshot?.snapshotJson) {
      try {
        const config: { pools?: Array<{ name?: string; ranges?: string }> } = JSON.parse(snapshot.snapshotJson);
        pools = (config.pools ?? []).map((pool) => {
          const ranges = pool.ranges;
          const capacity = capacityOf(ranges ?? "");
          const used = ranges
            ? leases.filter((lease) => inRanges(lease.ipAddress, ranges)).length
            : 0;
          return {
            name: pool.name,
            ranges: pool.ranges,
            capacity,
            used,
            utilization: capacity > 0 ? Math.min(100, (used / capacity) * 100) : 0,
          };
        });
      } catch {
        pools = [];
      }
    }
    const totalCapacity = pools.reduce((sum, pool) => sum + pool.capacity, 0);
    const totalUsed = leases.length;
    return {
      pools,
      totalCapacity,
      totalUsed,
      utilization: totalCapacity > 0 ? Math.min(100, (totalUsed / totalCapacity) * 100) : 0,
      observedAt: snapshot?.observedAt ?? null,
    };
  },
});

/** Current simple queues synced by the collector for a router. */
export const getSimpleQueues = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return ctx.db
      .query("simpleQueues")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();
  },
});

/** Latest telemetry details (identity, system health, ports, wifi radios). */
export const getRouterTelemetryLatest = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    return ctx.db
      .query("routerTelemetry")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();
  },
});

/** Recent telemetry self-health events for the ops-health strip. */
export const getRecentSystemEvents = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const events = await ctx.db
      .query("systemEvents")
      .withIndex("by_occurredAt", (q) => q)
      .order("desc")
      .take(args.limit ?? 8);
    const routerNameById = new Map<string, string>();
    for (const event of events) {
      if (!event.routerId || routerNameById.has(event.routerId)) continue;
      const router = await ctx.db.get(event.routerId);
      if (router) routerNameById.set(event.routerId, router.name);
    }
    return events.map((event) => ({
      ...event,
      routerName: event.routerId ? (routerNameById.get(event.routerId) ?? null) : null,
    }));
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
export const centipidCsvReconcile = internalMutation({
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

export const computeLeaderboardDaily = internalMutation({
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
export const runMonthlyCostReminder = internalMutation({
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
export const checkTicketSla = internalMutation({
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
export const purgeExpiredPii = internalMutation({
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
