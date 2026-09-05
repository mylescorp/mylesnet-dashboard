import { v } from "convex/values";
import { mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
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

function optionalClean(value: string | undefined, label: string, maxLength = 160): string | undefined {
  if (value === undefined) return undefined;
  const cleaned = value.trim();
  if (cleaned.length > maxLength) throw new Error(`Invalid ${label}`);
  return cleaned || undefined;
}

function validateMacAddress(value: string | undefined): string | undefined {
  const cleaned = optionalClean(value, "MAC address", 32);
  if (cleaned === undefined) return undefined;
  if (!/^([0-9A-Fa-f]{2}[:-]){5}[0-9A-Fa-f]{2}$/.test(cleaned)) throw new Error("MAC address must look like AA:BB:CC:DD:EE:FF");
  return cleaned.toUpperCase();
}

function validateIpAddress(value: string | undefined): string | undefined {
  const cleaned = optionalClean(value, "IP address", 64);
  if (cleaned === undefined) return undefined;
  const octets = cleaned.split(".");
  if (octets.length !== 4 || octets.some((octet) => !/^\d{1,3}$/.test(octet) || Number(octet) > 255)) {
    throw new Error("IP address must be a valid IPv4 address");
  }
  return cleaned;
}

async function assertSwitchForRouter(ctx: MutationCtx, switchId: string | undefined, routerId: Id<"routers">): Promise<void> {
  if (switchId === undefined) return;
  const existing = await ctx.db.get(switchId as Id<"networkSwitches">);
  if (!existing || existing.archivedAt !== undefined) throw new Error("Switch not found");
  if (existing.routerId !== routerId) throw new Error("Switch does not belong to this router");
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
    networkAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    model: v.optional(v.string()),
    note: v.optional(v.string()),
    switchId: v.optional(v.id("networkSwitches")),
    switchPort: v.optional(v.string()),
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
    await assertSwitchForRouter(ctx, args.switchId, args.routerId);
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
      networkAddress: optionalClean(args.networkAddress, "network address", 64),
      ipAddress: validateIpAddress(args.ipAddress),
      macAddress: validateMacAddress(args.macAddress),
      serialNumber: optionalClean(args.serialNumber, "serial number", 120),
      model: optionalClean(args.model, "model", 120),
      note: optionalClean(args.note, "note", 1000),
      switchId: args.switchId,
      switchPort: optionalClean(args.switchPort, "switch port", 80),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAudit(ctx, { action: "accessPoint.create", entityTable: "accessPoints", entityId: accessPointId, changedBy: user._id, after: { routerId: args.routerId, name, port, deviceType: args.deviceType, capacity, ipAddress: args.ipAddress, macAddress: args.macAddress, serialNumber: args.serialNumber, model: args.model, switchId: args.switchId, switchPort: args.switchPort } });
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
    networkAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    model: v.optional(v.string()),
    note: v.optional(v.string()),
    switchId: v.optional(v.id("networkSwitches")),
    switchPort: v.optional(v.string()),
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
    await assertSwitchForRouter(ctx, updates.switchId, accessPoint.routerId);
    const patch = { name, port, deviceType: updates.deviceType, sharesPortWith: updates.sharesPortWith === undefined ? undefined : cleanText(updates.sharesPortWith, "shared port reference", 160), capacity: validateCapacity(updates.capacity), rateLimitReference: updates.rateLimitReference === undefined ? undefined : cleanText(updates.rateLimitReference, "rate-limit reference", 160), networkAddress: optionalClean(updates.networkAddress, "network address", 64), ipAddress: validateIpAddress(updates.ipAddress), macAddress: validateMacAddress(updates.macAddress), serialNumber: optionalClean(updates.serialNumber, "serial number", 120), model: optionalClean(updates.model, "model", 120), note: optionalClean(updates.note, "note", 1000), switchId: updates.switchId, switchPort: optionalClean(updates.switchPort, "switch port", 80), updatedAt: Date.now() };
    await ctx.db.patch(accessPointId, patch);
    await logAudit(ctx, { action: "accessPoint.update", entityTable: "accessPoints", entityId: accessPointId, changedBy: user._id, before: { name: accessPoint.name, port: accessPoint.port, deviceType: accessPoint.deviceType }, after: { name: patch.name ?? accessPoint.name, port: patch.port ?? accessPoint.port, deviceType: patch.deviceType ?? accessPoint.deviceType, switchId: patch.switchId, switchPort: patch.switchPort } });
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
