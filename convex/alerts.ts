import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformAdmin, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Raise an alert for a device going offline. If the device is a MikroTik
 * gateway (has child devices via devices.parentDeviceId), all of its
 * dependent APs that are ALSO unreachable get folded into ONE alert here —
 * never N separate notifications. Devices in "maintenance" lifecycle state
 * never fire alerts at all, checked before anything else.
 */
export const raiseDeviceOfflineAlert = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Device not found");

    if (device.lifecycleStatus === "maintenance") {
      return { suppressed: true, reason: "device_in_maintenance" };
    }

    // Already-open alert for this root device? Don't duplicate.
    const existingOpen = await ctx.db
      .query("alerts")
      .withIndex("by_rootDevice", (q) => q.eq("rootDeviceId", args.deviceId))
      .filter((q) => q.eq(q.field("alertStatus"), "open"))
      .first();
    if (existingOpen) {
      return { suppressed: true, reason: "already_open" };
    }

    let dependentDeviceIds: typeof device._id[] = [];
    let message = `${device.name} is offline.`;

    if (device.deviceKind === "mikrotik_gateway") {
      const children = await ctx.db
        .query("devices")
        .withIndex("by_parent", (q) => q.eq("parentDeviceId", args.deviceId))
        .filter((q) =>
          q.and(
            q.neq(q.field("lifecycleStatus"), "maintenance"),
            q.neq(q.field("status"), "deleted")
          )
        )
        .collect();
      dependentDeviceIds = children.map((c) => c._id);
      if (dependentDeviceIds.length > 0) {
        message = `Market offline (MikroTik down, ${dependentDeviceIds.length} dependent AP(s) unreachable).`;
      }
    }

    const alertId = await ctx.db.insert("alerts", {
      marketId: device.marketId,
      rootDeviceId: args.deviceId,
      dependentDeviceIds,
      alertType: "device_offline",
      message,
      alertStatus: "open",
      openedAt: Date.now(),
    });

    return { suppressed: false, alertId };
  },
});

export const acknowledgeAlert = mutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");

    await ctx.db.patch(args.alertId, {
      alertStatus: "acknowledged",
      acknowledgedBy: user._id,
      acknowledgedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "alert.acknowledge",
      entityTable: "alerts",
      entityId: args.alertId,
      changedBy: user._id,
    });
  },
});

export const resolveAlert = mutation({
  args: { alertId: v.id("alerts") },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const alert = await ctx.db.get(args.alertId);
    if (!alert) throw new Error("Alert not found");

    await ctx.db.patch(args.alertId, {
      alertStatus: "resolved",
      resolvedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "alert.resolve",
      entityTable: "alerts",
      entityId: args.alertId,
      changedBy: user._id,
    });
  },
});

export const listOpenAlerts = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    return await ctx.db
      .query("alerts")
      .withIndex("by_status", (q) => q.eq("alertStatus", "open"))
      .collect();
  },
});

export const listAlerts = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    return (await ctx.db.query("alerts").collect()).sort(
      (a, b) => b.openedAt - a.openedAt
    );
  },
});
