import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { sha256Hex } from "./siteKit";

/**
 * Site-device telemetry ingestion (spec §10 siteKit + §20 telemetry). Outdoor
 * access points report via `/api/telemetry` with their market's site key. Each
 * report self-registers the device (by MAC), updates liveness, and folds the
 * reading into the hourly rollup so capacity/analytics see it next cron tick.
 */

const HOUR_MS = 60 * 60 * 1000;
const hourBucket = (timestamp: number) => Math.floor(timestamp / HOUR_MS) * HOUR_MS;

export const ingestSpecTelemetry = internalMutation({
  args: {
    marketId: v.id("markets"),
    observedAt: v.number(),
    devices: v.array(
      v.object({
        macAddress: v.string(),
        model: v.optional(v.string()),
        firmware: v.optional(v.string()),
        ccq: v.optional(v.number()),
        signalStrengthDbm: v.optional(v.number()),
        clientCount: v.optional(v.number()),
        txBytesPerSec: v.optional(v.number()),
        rxBytesPerSec: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const now = args.observedAt;
    const results: { registered: number; updated: number } = { registered: 0, updated: 0 };

    for (const device of args.devices) {
      const mac = device.macAddress.toUpperCase();
      const existing = await ctx.db
        .query("devices")
        .withIndex("by_macAddress", (q) => q.eq("macAddress", mac))
        .filter((q) => q.eq(q.field("marketId"), args.marketId))
        .first();

      let deviceId = existing?._id;
      if (!existing) {
        deviceId = await ctx.db.insert("devices", {
          marketId: args.marketId,
          name: `Outdoor AP ${mac.slice(-6)}`,
          deviceKind: "outdoor_ap",
          deviceType: "outdoor_ap",
          macAddress: mac,
          serialOrMac: mac,
          role: "site_ap",
          lifecycleStatus: "active",
          status: "online",
          createdAt: now,
          updatedAt: now,
          lastSeenAt: now,
          registeredBy: "self",
        });
        results.registered += 1;
      } else {
        await ctx.db.patch(existing._id, {
          lastSeenAt: now,
          updatedAt: now,
          status: "online",
          ...(device.model ? { serialOrMac: device.model } : {}),
        });
        results.updated += 1;
      }

      // Upsert into the current hour bucket, keyed by the estate device row
      // (by_device_hour), so the nightly hourly->daily pass groups per AP.
      const bucket = hourBucket(now);
      const row = await ctx.db
        .query("telemetryHourly")
        .withIndex("by_device_hour", (q) => q.eq("deviceId", deviceId!))
        .filter((q) => q.eq(q.field("hourStart"), bucket))
        .first();

      const txMbps = ((device.txBytesPerSec ?? 0) * 8) / 1_000_000;
      const rxMbps = ((device.rxBytesPerSec ?? 0) * 8) / 1_000_000;
      const ccq = device.ccq;
      const signal = device.signalStrengthDbm;
      const clients = device.clientCount ?? 0;
      if (row) {
        await ctx.db.patch(row._id, {
          sampleCount: row.sampleCount + 1,
          avgCcq: ccq,
          avgSignalStrengthDbm: signal,
          maxConnectedClients: Math.max(row.maxConnectedClients, clients),
          avgTxRateMbps: txMbps,
          avgRxRateMbps: rxMbps,
          maxTxRateMbps: Math.max(row.maxTxRateMbps, txMbps),
          maxRxRateMbps: Math.max(row.maxRxRateMbps, rxMbps),
        });
      } else {
        await ctx.db.insert("telemetryHourly", {
          marketId: args.marketId,
          deviceKind: "access_point",
          accessPointId: undefined,
          deviceId,
          hourStart: bucket,
          sampleCount: 1,
          avgCcq: ccq,
          avgSignalStrengthDbm: signal,
          maxConnectedClients: clients,
          avgTxRateMbps: txMbps,
          avgRxRateMbps: rxMbps,
          maxTxRateMbps: txMbps,
          maxRxRateMbps: rxMbps,
        });
      }
    }

    return results;
  },
});

export const registerSpecDevice = internalMutation({
  args: {
    marketId: v.id("markets"),
    macAddress: v.string(),
    model: v.optional(v.string()),
    deviceType: v.union(v.literal("mikrotik"), v.literal("outdoor_ap"), v.literal("indoor_ap"), v.literal("extender")),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const mac = args.macAddress.toUpperCase();
    const existing = await ctx.db
      .query("devices")
      .withIndex("by_macAddress", (q) => q.eq("macAddress", mac))
      .filter((q) => q.eq(q.field("marketId"), args.marketId))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, { lastSeenAt: Date.now(), updatedAt: Date.now() });
      return { deviceId: existing._id, created: false };
    }
    const now = Date.now();
    const id = await ctx.db.insert("devices", {
      marketId: args.marketId,
      name: args.name ?? `Site device ${mac.slice(-6)}`,
      deviceKind: args.deviceType,
      deviceType: args.deviceType,
      macAddress: mac,
      serialOrMac: mac,
      role: "site_device",
      lifecycleStatus: "active",
      status: "unverified",
      createdAt: now,
      updatedAt: now,
      lastSeenAt: now,
      registeredBy: "self",
    });
    return { deviceId: id, created: true };
  },
});

export { sha256Hex };