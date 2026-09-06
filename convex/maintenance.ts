import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { requirePermission, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Scheduled maintenance windows (spec §17). While a window covering a device
 * (or its market) is active with suppressAlerts, offline/quality alerts for
 * that device are suppressed so planned work doesn't page operators.
 */
export const createMaintenanceWindow = mutation({
  args: {
    marketId: v.id("markets"),
    deviceId: v.optional(v.id("devices")),
    scheduledStart: v.number(),
    scheduledEnd: v.number(),
    reason: v.string(),
    suppressAlerts: v.boolean(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "alerts:manage");
    if (args.scheduledEnd <= args.scheduledStart) throw new Error("End must be after start");

    const id = await ctx.db.insert("maintenanceWindows", {
      marketId: args.marketId,
      deviceId: args.deviceId,
      scheduledStart: args.scheduledStart,
      scheduledEnd: args.scheduledEnd,
      reason: args.reason,
      suppressAlerts: args.suppressAlerts,
      status: "scheduled",
      createdBy: user._id,
      notes: args.notes,
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "maintenance.create",
      entityTable: "maintenanceWindows",
      entityId: id,
      changedBy: user._id,
      after: args,
    });
    return id;
  },
});

export const cancelMaintenanceWindow = mutation({
  args: { windowId: v.id("maintenanceWindows") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "alerts:manage");
    await ctx.db.patch(args.windowId, { status: "cancelled" });
    await logAudit(ctx, {
      action: "maintenance.cancel",
      entityTable: "maintenanceWindows",
      entityId: args.windowId,
      changedBy: user._id,
    });
  },
});

export const completeMaintenanceWindow = mutation({
  args: { windowId: v.id("maintenanceWindows") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "alerts:manage");
    await ctx.db.patch(args.windowId, { status: "completed" });
    await logAudit(ctx, {
      action: "maintenance.complete",
      entityTable: "maintenanceWindows",
      entityId: args.windowId,
      changedBy: user._id,
    });
  },
});

export const listMaintenanceWindows = query({
  args: { marketId: v.optional(v.id("markets")), includeClosed: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const marketId = args.marketId;
    const base = marketId !== undefined
      ? await ctx.db.query("maintenanceWindows").withIndex("by_market", (q) => q.eq("marketId", marketId)).collect()
      : await ctx.db.query("maintenanceWindows").collect();
    const open = base.filter((w) => w.status === "scheduled" || w.status === "active");
    const rows = args.includeClosed ? base : open;
    return rows.sort((a, b) => b.scheduledStart - a.scheduledStart);
  },
});

/** During a maintenance window, promote scheduled -> active. Called by the crons job. */
export const advanceMaintenanceWindows = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const windows = await ctx.db.query("maintenanceWindows").withIndex("by_status", (q) => q.eq("status", "scheduled")).collect();
    let advanced = 0;
    for (const w of windows) {
      if (w.scheduledStart <= now) {
        await ctx.db.patch(w._id, { status: "active" });
        advanced += 1;
      }
    }
    return { advanced };
  },
});

/** Whether a device is covered by an active suppressing maintenance window right now. */
export const deviceInMaintenance = internalQuery({
  args: { deviceId: v.id("devices"), marketId: v.id("markets") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const windows = await ctx.db.query("maintenanceWindows").withIndex("by_market", (q) => q.eq("marketId", args.marketId)).filter((q) => q.eq(q.field("status"), "active")).collect();
    const covered =
      windows.some((w) => w.deviceId === args.deviceId || (w.deviceId === undefined && w.suppressAlerts)) ||
      windows.some((w) => w.suppressAlerts && w.scheduledStart <= now && w.scheduledEnd >= now);
    return covered;
  },
});