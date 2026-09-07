import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const listDevices = query({
  args: { marketId: v.optional(v.id("markets")) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "devices:read");
    const rows = args.marketId
      ? await ctx.db
          .query("devices")
          .withIndex("by_market", (idx) => idx.eq("marketId", args.marketId!))
          .filter((r) => r.neq(r.field("status"), "deleted"))
          .collect()
      : await ctx.db
          .query("devices")
          .filter((r) => r.neq(r.field("status"), "deleted"))
          .collect();
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getDevice = query({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "devices:read");
    return await ctx.db.get(args.deviceId);
  },
});

export const listDeviceReplacementEvents = query({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "devices:read");
    return await ctx.db
      .query("deviceReplacementEvents")
      .withIndex("by_device", (q) => q.eq("deviceId", args.deviceId))
      .collect();
  },
});

export const createDevice = mutation({
  args: {
    marketId: v.id("markets"),
    parentDeviceId: v.optional(v.id("devices")),
    name: v.string(),
    deviceKind: v.union(
      v.literal("mikrotik_gateway"),
      v.literal("cpe220"),
      v.literal("cpe710"),
      v.literal("indoor_ap"),
      v.literal("other")
    ),
    serialOrMac: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const now = Date.now();
    const deviceId = await ctx.db.insert("devices", {
      marketId: args.marketId,
      parentDeviceId: args.parentDeviceId,
      name: args.name,
      deviceKind: args.deviceKind,
      serialOrMac: args.serialOrMac,
      lifecycleStatus: "active",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "device.create",
      entityTable: "devices",
      entityId: deviceId,
      changedBy: user._id,
      after: { name: args.name, deviceKind: args.deviceKind },
    });
    return deviceId;
  },
});

/**
 * Log a hardware replacement. The device record itself is never overwritten
 * on a hardware swap — the exchange is recorded as a replacement event and
 * the device is put into maintenance so alerting stops while it is down.
 */
export const logDeviceReplacement = mutation({
  args: {
    deviceId: v.id("devices"),
    newSerialOrMac: v.optional(v.string()),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Device not found");

    await ctx.db.insert("deviceReplacementEvents", {
      deviceId: args.deviceId,
      replacedAt: Date.now(),
      oldSerialOrMac: device.serialOrMac,
      newSerialOrMac: args.newSerialOrMac,
      reason: args.reason,
      loggedBy: user._id,
    });

    await ctx.db.patch(args.deviceId, {
      serialOrMac: args.newSerialOrMac,
      lifecycleStatus: "maintenance",
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "device.replacementLogged",
      entityTable: "devices",
      entityId: args.deviceId,
      changedBy: user._id,
      after: { newSerialOrMac: args.newSerialOrMac, reason: args.reason },
    });
  },
});

/** Maintenance toggle — planned downtime that suppresses alerts. */
export const setDeviceMaintenance = mutation({
  args: { deviceId: v.id("devices"), inMaintenance: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Device not found");

    const nextStatus = args.inMaintenance ? "maintenance" : "active";
    await ctx.db.patch(args.deviceId, {
      lifecycleStatus: nextStatus,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: args.inMaintenance ? "device.maintenanceOn" : "device.maintenanceOff",
      entityTable: "devices",
      entityId: args.deviceId,
      changedBy: user._id,
      before: { lifecycleStatus: device.lifecycleStatus },
      after: { lifecycleStatus: nextStatus },
    });
  },
});

export const softDeleteDevice = mutation({
  args: { deviceId: v.id("devices"), deleteReason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Device not found");

    // A MikroTik gateway that still has children is refused — reassign or
    // delete those dependents first (same rule as market cascade).
    if (device.deviceKind === "mikrotik_gateway") {
      const children = await ctx.db
        .query("devices")
        .withIndex("by_parent", (q) => q.eq("parentDeviceId", args.deviceId))
        .filter((q) => q.neq(q.field("status"), "deleted"))
        .collect();
      if (children.length > 0) {
        throw new Error(
          `This gateway still has ${children.length} child device(s). Remove or reassign them first.`
        );
      }
    }

    await ctx.db.patch(args.deviceId, {
      status: "deleted",
      lifecycleStatus: "deleted",
      deletedAt: Date.now(),
      deletedBy: user._id,
      deleteReason: args.deleteReason,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "device.softDelete",
      entityTable: "devices",
      entityId: args.deviceId,
      changedBy: user._id,
      after: { deleteReason: args.deleteReason },
    });
  },
});

export const restoreDevice = mutation({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "devices:manage");
    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Device not found");

    await ctx.db.patch(args.deviceId, {
      status: "active",
      lifecycleStatus: "active",
      restoredAt: Date.now(),
      restoredBy: user._id,
      updatedAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "device.restore",
      entityTable: "devices",
      entityId: args.deviceId,
      changedBy: user._id,
    });
  },
});
