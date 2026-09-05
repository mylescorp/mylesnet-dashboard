import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireNetworkOperator, requirePlatformAdmin } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

function cleanText(value: string, label: string, maxLength = 160): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) throw new Error(`Invalid ${label}`);
  return cleaned;
}

function validateCapacity(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1 || value > 10000) throw new Error("Capacity must be a whole number between 1 and 10,000");
  return value;
}

// Add an access point to a router
export const addAccessPoint = mutation({
  args: {
    routerId: v.id("routers"),
    name: v.string(),
    port: v.string(),
    deviceType: v.union(v.literal("cpe220"), v.literal("indoor_ap"), v.literal("builtin_radio"), v.literal("other")),
    sharesPortWith: v.optional(v.string()),
    capacity: v.optional(v.number()),
    rateLimitReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found");
    const name = cleanText(args.name, "access point name");
    const port = cleanText(args.port, "RouterOS interface", 80);
    const capacity = validateCapacity(args.capacity);
    const rateLimitReference = args.rateLimitReference === undefined ? undefined : cleanText(args.rateLimitReference, "rate-limit reference", 160);
    const sharesPortWith = args.sharesPortWith === undefined ? undefined : cleanText(args.sharesPortWith, "shared port reference", 160);
    const duplicate = await ctx.db.query("accessPoints").withIndex("by_router", (q) => q.eq("routerId", args.routerId)).filter((q) => q.eq(q.field("port"), port)).first();
    if (duplicate && duplicate.archivedAt === undefined) throw new Error("An active access point already uses this RouterOS interface");
    const accessPointId = await ctx.db.insert("accessPoints", {
      routerId: args.routerId,
      name,
      port,
      deviceType: args.deviceType,
      sharesPortWith,
      capacity,
      rateLimitReference,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAudit(ctx, { action: "accessPoint.create", entityTable: "accessPoints", entityId: accessPointId, changedBy: user._id, after: { routerId: args.routerId, name, port, deviceType: args.deviceType, capacity } });
    return accessPointId;
  },
});

// List access points for a router
export const listAccessPoints = query({
  args: { routerId: v.optional(v.id("routers")) },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
    if (!args.routerId) {
      return (await ctx.db.query("accessPoints").collect()).filter((accessPoint) => accessPoint.archivedAt === undefined);
    }
    const routerId = args.routerId;
    return (await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", routerId))
      .collect()).filter((accessPoint) => accessPoint.archivedAt === undefined);
  },
});

// Update access point
export const updateAccessPoint = mutation({
  args: {
    accessPointId: v.id("accessPoints"),
    name: v.optional(v.string()),
    port: v.optional(v.string()),
    deviceType: v.optional(v.union(v.literal("cpe220"), v.literal("indoor_ap"), v.literal("builtin_radio"), v.literal("other"))),
    sharesPortWith: v.optional(v.string()),
    capacity: v.optional(v.number()),
    rateLimitReference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const { accessPointId, ...updates } = args;
    const accessPoint = await ctx.db.get(accessPointId);
    if (!accessPoint || accessPoint.archivedAt !== undefined) throw new Error("Access point not found");
    const name = updates.name === undefined ? undefined : cleanText(updates.name, "access point name");
    const port = updates.port === undefined ? undefined : cleanText(updates.port, "RouterOS interface", 80);
    if (port && port !== accessPoint.port) {
      const duplicate = await ctx.db.query("accessPoints").withIndex("by_router", (q) => q.eq("routerId", accessPoint.routerId)).filter((q) => q.eq(q.field("port"), port)).first();
      if (duplicate && duplicate._id !== accessPointId && duplicate.archivedAt === undefined) throw new Error("An active access point already uses this RouterOS interface");
    }
    const patch = { name, port, deviceType: updates.deviceType, sharesPortWith: updates.sharesPortWith === undefined ? undefined : cleanText(updates.sharesPortWith, "shared port reference", 160), capacity: validateCapacity(updates.capacity), rateLimitReference: updates.rateLimitReference === undefined ? undefined : cleanText(updates.rateLimitReference, "rate-limit reference", 160), updatedAt: Date.now() };
    await ctx.db.patch(accessPointId, patch);
    await logAudit(ctx, { action: "accessPoint.update", entityTable: "accessPoints", entityId: accessPointId, changedBy: user._id, before: { name: accessPoint.name, port: accessPoint.port, deviceType: accessPoint.deviceType }, after: { name: patch.name ?? accessPoint.name, port: patch.port ?? accessPoint.port, deviceType: patch.deviceType ?? accessPoint.deviceType } });
  },
});

/** Archive instead of deleting to preserve telemetry and incident references. */
export const archiveAccessPoint = mutation({
  args: { accessPointId: v.id("accessPoints"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const accessPoint = await ctx.db.get(args.accessPointId);
    if (!accessPoint || accessPoint.archivedAt !== undefined) throw new Error("Access point not found");
    const reason = cleanText(args.reason, "archive reason", 300);
    await ctx.db.patch(args.accessPointId, { archivedAt: Date.now(), archivedBy: user._id, archiveReason: reason, updatedAt: Date.now() });
    await logAudit(ctx, { action: "accessPoint.archive", entityTable: "accessPoints", entityId: args.accessPointId, changedBy: user._id, before: { name: accessPoint.name, port: accessPoint.port }, after: { reason } });
  },
});
