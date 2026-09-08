import { query } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  isPlatformUser,
  requireAuthenticatedUser,
  resolveRoles,
  resolveUserByIdentity,
} from "./lib/auth";

const COLLECTOR_HEALTH_MS = 90_000;
const EVENT_WINDOW_MS = 24 * 60 * 60 * 1000;
const TICKET_SLA_MS = 48 * 60 * 60 * 1000;

function activeRecords<T extends { archivedAt?: number }>(rows: T[]): T[] {
  return rows.filter((row) => row.archivedAt === undefined);
}

/**
 * Aggregate estate capacity indicators for the dashboard gauges. Mirrors the
 * bounded scan pattern of `operations.getKpis`, so it stays inside query
 * resource limits: one pool overview + one AP session count per router/AP.
 */
export const getDashboardIndicators = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const routers = activeRecords(await ctx.db.query("routers").collect());

    let dhcpCapacity = 0;
    let dhcpUsed = 0;
    let apCapacity = 0;
    let apUsers = 0;

    for (const router of routers) {
      const pool = await ctx.runQuery(internal.operations.getDhcpPoolOverviewForRouter, {
        routerId: router._id,
      });
      dhcpCapacity += pool.totalCapacity;
      dhcpUsed += pool.totalUsed;

      const accessPoints = activeRecords(
        await ctx.db
          .query("accessPoints")
          .withIndex("by_router", (q) => q.eq("routerId", router._id))
          .collect(),
      );
      for (const accessPoint of accessPoints) {
        apCapacity += accessPoint.capacity ?? 0;
        const sessions = await ctx.db
          .query("activeHotspotSessions")
          .withIndex("by_access_point", (q) => q.eq("accessPointId", accessPoint._id))
          .collect();
        apUsers += sessions.length;
      }
    }

    return {
      dhcp: {
        totalCapacity: dhcpCapacity,
        totalUsed: dhcpUsed,
        utilization: dhcpCapacity > 0 ? Math.round((dhcpUsed / dhcpCapacity) * 100) : 0,
      },
      apCapacity: {
        totalCapacity: apCapacity,
        totalUsed: apUsers,
        utilization: apCapacity > 0 ? Math.round((apUsers / apCapacity) * 100) : 0,
      },
    };
  },
});

/**
 * Actionable alert counts for the dashboard alert strip and the topbar bell.
 *
 * Ops-facing counts (events, collectors, access points, SLA-breached tickets)
 * are computed for every authenticated user. Business counts (unreconciled
 * payments, expiring subscriptions, commission approvals, offboarding) are only
 * surfaced to platform users.
 */
export const getDashboardAlerts = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const now = Date.now();

    const user = await resolveUserByIdentity(ctx);
    let isPlatform = false;
    if (user) {
      isPlatform = isPlatformUser(await resolveRoles(ctx, user));
    }

    const [recentEvents, creds] = await Promise.all([
      ctx.db
        .query("systemEvents")
        .withIndex("by_occurredAt", (q) => q)
        .order("desc")
        .take(50),
      ctx.db.query("centipidCredentials").order("desc").first(),
    ]);

    const severeEvents24h = recentEvents.filter(
      (event) =>
        (event.severity === "warning" || event.severity === "critical") &&
        now - event.occurredAt < EVENT_WINDOW_MS,
    ).length;

    const routers = activeRecords(await ctx.db.query("routers").collect());
    let failedCollectors = 0;
    let accessPointsOffline = 0;
    for (const router of routers) {
      const latestRun = await ctx.db
        .query("collectorRuns")
        .withIndex("by_router_observedAt", (q) => q.eq("routerId", router._id))
        .order("desc")
        .first();
      if (
        latestRun &&
        (latestRun.status === "failed" || now - latestRun.observedAt > COLLECTOR_HEALTH_MS)
      ) {
        failedCollectors += 1;
      }
      const accessPoints = activeRecords(
        await ctx.db
          .query("accessPoints")
          .withIndex("by_router", (q) => q.eq("routerId", router._id))
          .collect(),
      );
      for (const accessPoint of accessPoints) {
        const latest = await ctx.db
          .query("accessPointSamples")
          .withIndex("by_access_point_timestamp", (q) => q.eq("accessPointId", accessPoint._id))
          .order("desc")
          .first();
        if (latest && !latest.linkState) accessPointsOffline += 1;
      }
    }

    const openTickets = await ctx.db
      .query("ticketStatus")
      .withIndex("by_status", (q) => q.eq("status", "open"))
      .collect();
    const ticketsOverSla = openTickets.filter((ticket) => now - ticket.openedAt > TICKET_SLA_MS).length;

    let unreconciledPayments: number | null = null;
    let expiring24h: number | null = null;
    let commissionsAwaiting = 0;
    let agentsAwaitingOffboard = 0;
    if (isPlatform) {
      unreconciledPayments = creds?.liveSnapshotUnreconciledPayments ?? null;
      expiring24h = creds?.liveSnapshotExpiring24h ?? null;
      commissionsAwaiting = (
        await ctx.db
          .query("commissions")
          .withIndex("by_status", (q) => q.eq("payoutStatus", "requested"))
          .collect()
      ).length;
      agentsAwaitingOffboard = (
        await ctx.db
          .query("agents")
          .filter((q) =>
            q.and(
              q.eq(q.field("lifecycleStatus"), "terminated"),
              q.eq(q.field("status"), "deleted"),
              q.eq(q.field("deleteReason"), "Offboarded"),
            ),
          )
          .collect()
      ).length;
    }

    const opsTotal = severeEvents24h + failedCollectors + accessPointsOffline + ticketsOverSla;
    const businessTotal =
      commissionsAwaiting + agentsAwaitingOffboard + (expiring24h ?? 0) + (unreconciledPayments ?? 0);

    return {
      at: now,
      severeEvents24h,
      failedCollectors,
      accessPointsOffline,
      ticketsOverSla,
      unreconciledPayments,
      expiring24h,
      commissionsAwaiting,
      agentsAwaitingOffboard,
      businessVisible: isPlatform,
      opsTotal,
      businessTotal,
      total: opsTotal + (isPlatform ? businessTotal : 0),
    };
  },
});