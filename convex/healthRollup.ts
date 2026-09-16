import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePlatformUser } from "./lib/auth";
import {
  computeDeviceHealthTone,
  buildHealthRollupRow,
  type HealthTone,
} from "./lib/healthRollupCore";

// Aggregation windows. Configurable downstream per spec B5, but the overview
// is a read-only rollup: it never mutates fleet state, so these constants are
// the single tuning point rather than database fields.
const OFFLINE_AFTER_MS = 24 * 60 * 60 * 1000; // 24h device silence -> critical
const WARNING_AFTER_MS = 2 * 60 * 60 * 1000; // 2h device silence -> warning
const SAMPLE_FRESHNESS_MS = 30 * 60 * 1000; // router/AP health sample <= 30m old

export const getPlatformHealthOverview = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const now = Date.now();

    const devices = await ctx.db.query("devices").collect();
    const activeDevices = devices.filter((d) => d.lifecycleStatus !== "deleted");
    const routers = await ctx.db.query("routers").collect();
    const switches = await ctx.db.query("networkSwitches").collect();
    const openAlerts = await ctx.db
      .query("alerts")
      .withIndex("by_status", (q) => q.eq("alertStatus", "open"))
      .take(500);

    // Latest router health sample per router (skip access-point rows)
    const latestSampleByRouter = new Map<string, ReturnType<typeof buildLatestSampleRow>>();
    for (const router of routers) {
      const sample = await ctx.db
        .query("healthSamples")
        .withIndex("by_router_timestamp", (q) => q.eq("routerId", router._id))
        .order("desc")
        .first();
      if (sample && sample.accessPointId === undefined) {
        latestSampleByRouter.set(router._id, buildLatestSampleRow(sample));
      }
    }

    const markets = await ctx.db.query("markets").collect();
    const marketName = new Map(markets.map((m) => [m._id, m.name]));
    const marketTenant = new Map(markets.map((m) => [m._id, m.tenantId ?? null]));
    const tenantName = new Map(
      (await ctx.db.query("tenants").collect()).map((t) => [t._id, t.name]),
    );

    const deviceRows = activeDevices.map((device) => {
      const resolvedTenantId = device.tenantId ?? marketTenant.get(device.marketId) ?? null;
      const tone = computeDeviceHealthTone({
        lifecycleStatus: device.lifecycleStatus,
        status: device.status,
        uptimePercent: device.uptimePercent,
        lastSeenAt: device.lastSeenAt,
        now,
        offlineAfterMs: OFFLINE_AFTER_MS,
        warningAfterMs: WARNING_AFTER_MS,
      });
      return {
        _id: device._id,
        name: device.name,
        deviceKind: device.deviceKind,
        marketId: device.marketId,
        marketName: marketName.get(device.marketId) ?? null,
        tenantId: resolvedTenantId,
        tenantName: resolvedTenantId ? (tenantName.get(resolvedTenantId) ?? null) : null,
        tone,
        lifecycleStatus: device.lifecycleStatus,
        lastSeenAt: device.lastSeenAt,
        uptimePercent: device.uptimePercent,
        firmwareVersion: device.firmwareVersion,
        routerId: device.routerId ?? null,
        routerName: device.routerId ? (routers.find((r) => r._id === device.routerId)?.name ?? null) : null,
      };
    });

    const routerRows = routers.map((router) => {
      const latest = latestSampleByRouter.get(router._id) ?? null;
      const sampleFresh =
        latest !== null && now - latest.timestamp <= SAMPLE_FRESHNESS_MS;
      const tone: HealthTone = latest === null ? "unknown" : sampleFresh ? "ok" : "warning";
      // Open alerts attach to a root device; a router is degraded if any of the
      // devices bridged to it (device.routerId) has an unacknowledged alert.
      const routerDeviceIds = new Set(
        activeDevices
          .filter((d) => d.routerId === router._id)
          .map((d) => d._id),
      );
      const openForRouter =
        routerDeviceIds.size > 0 &&
        openAlerts.some((alert) => alert.rootDeviceId !== undefined && routerDeviceIds.has(alert.rootDeviceId));
      return {
        _id: router._id,
        name: router.name,
        marketId: router.marketId ?? null,
        marketName: router.marketId ? (marketName.get(router.marketId) ?? null) : null,
        tone: openForRouter ? "critical" : tone,
        latest,
        managedSwitches: switches.filter(
          (s) => s.routerId === router._id && s.managed === true,
        ).length,
      };
    });

    const overview = buildHealthRollupRow({
      now,
      offlineAfterMs: OFFLINE_AFTER_MS,
      warningAfterMs: WARNING_AFTER_MS,
      deviceTones: deviceRows.map((r) => r.tone),
      uptimeValues: deviceRows.map((r) => r.uptimePercent),
      firmwareValues: deviceRows.map((r) => r.firmwareVersion),
      routerTotal: routers.length,
      routerRecentSamples: routerRows.filter((r) => r.tone === "ok").length,
      openAlerts: openAlerts.map((a) => ({
        severity: a.severity === "info" ? "info" : a.severity === "critical" ? "critical" : "warning",
      })),
    });

    const openAlertsSummary = openAlerts.map((a) => ({
      _id: a._id,
      severity: a.severity,
      message: a.message,
      openedAt: a.openedAt,
      marketId: a.marketId ?? null,
    }));

    return { overview, deviceRows, deviceToneCounts: overview.devices.byTone, routerRows, openAlerts: openAlertsSummary };
  },
});

function buildLatestSampleRow(sample: {
  timestamp: number;
  cpuPercent: number;
  memoryPercent: number;
  linkState: boolean;
  connectedUserCount?: number | null | undefined;
  txBytesPerSec: number;
  rxBytesPerSec: number;
}) {
  return {
    timestamp: sample.timestamp,
    cpuPercent: sample.cpuPercent,
    memoryPercent: sample.memoryPercent,
    linkState: sample.linkState,
    connectedUserCount: sample.connectedUserCount ?? null,
    txBytesPerSec: sample.txBytesPerSec,
    rxBytesPerSec: sample.rxBytesPerSec,
  };
}

export const getPlatformRouterHealthDetail = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const router = await ctx.db.get(args.routerId);
    if (!router) return null;

    const now = Date.now();
    const cutoff = now - 24 * 60 * 60 * 1000;
    const samples = await ctx.db
      .query("healthSamples")
      .withIndex("by_router_timestamp", (q) =>
        q.eq("routerId", args.routerId).gte("timestamp", cutoff),
      )
      .collect();

    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();
    const accessPointHealth = (
      await Promise.all(
        accessPoints.map(async (ap) => ({
          accessPointId: ap._id,
          name: ap.name,
          latest: await ctx.db
            .query("accessPointSamples")
            .withIndex("by_access_point_timestamp", (q) => q.eq("accessPointId", ap._id))
            .order("desc")
            .first(),
        })),
      )
    ).map((row) => ({
      accessPointId: row.accessPointId,
      name: row.name,
      latest: row.latest
        ? {
            timestamp: row.latest.timestamp,
            linkState: row.latest.linkState,
            connectedUserCount: row.latest.connectedUserCount ?? null,
            ccq: row.latest.ccq ?? null,
            signalStrengthDbm: row.latest.signalStrengthDbm ?? null,
          }
        : null,
    }));

    return {
      _id: router._id,
      name: router.name,
      marketId: router.marketId ?? null,
      samples: samples.map((s) =>
        buildLatestSampleRow({
          timestamp: s.timestamp,
          cpuPercent: s.cpuPercent,
          memoryPercent: s.memoryPercent,
          linkState: s.linkState,
          connectedUserCount: s.connectedUserCount,
          txBytesPerSec: s.txBytesPerSec,
          rxBytesPerSec: s.rxBytesPerSec,
        }),
      ),
      accessPointHealth,
    };
  },
});