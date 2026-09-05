import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireNetworkOperator, requirePlatformAdmin } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

function cleanText(value: string, label: string, maxLength = 160): string {
  const cleaned = value.trim();
  if (!cleaned || cleaned.length > maxLength) throw new Error(`Invalid ${label}`);
  return cleaned;
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

function validatePortCount(value: number | undefined): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || value < 1 || value > 1000) throw new Error("Port count must be a whole number between 1 and 1,000");
  return value;
}

// List switches, optionally scoped to a router
export const listSwitches = query({
  args: { routerId: v.optional(v.id("routers")) },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
    if (!args.routerId) return (await ctx.db.query("networkSwitches").collect()).filter((entry) => entry.archivedAt === undefined);
    return (await ctx.db.query("networkSwitches").withIndex("by_router", (q) => q.eq("routerId", args.routerId!)).collect()).filter((entry) => entry.archivedAt === undefined);
  },
});

export const addSwitch = mutation({
  args: {
    routerId: v.id("routers"),
    name: v.string(),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    routerPort: v.optional(v.string()),
    portCount: v.optional(v.number()),
    managed: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found");
    const name = cleanText(args.name, "switch name");
    const switchId = await ctx.db.insert("networkSwitches", {
      routerId: args.routerId,
      name,
      model: optionalClean(args.model, "switch model", 120),
      serialNumber: optionalClean(args.serialNumber, "serial number", 120),
      macAddress: validateMacAddress(args.macAddress),
      ipAddress: validateIpAddress(args.ipAddress),
      routerPort: optionalClean(args.routerPort, "router port", 80),
      portCount: validatePortCount(args.portCount),
      managed: args.managed,
      note: optionalClean(args.note, "note", 1000),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await logAudit(ctx, { action: "networkSwitch.create", entityTable: "networkSwitches", entityId: switchId, changedBy: user._id, after: { routerId: args.routerId, name, model: args.model, serialNumber: args.serialNumber, macAddress: args.macAddress, routerPort: args.routerPort, portCount: args.portCount } });
    return switchId;
  },
});

export const updateSwitch = mutation({
  args: {
    switchId: v.id("networkSwitches"),
    name: v.optional(v.string()),
    model: v.optional(v.string()),
    serialNumber: v.optional(v.string()),
    macAddress: v.optional(v.string()),
    ipAddress: v.optional(v.string()),
    routerPort: v.optional(v.string()),
    portCount: v.optional(v.number()),
    managed: v.optional(v.boolean()),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const { switchId, ...updates } = args;
    const existing = await ctx.db.get(switchId);
    if (!existing || existing.archivedAt !== undefined) throw new Error("Switch not found");
    const patch = {
      name: updates.name === undefined ? undefined : cleanText(updates.name, "switch name"),
      model: optionalClean(updates.model, "switch model", 120),
      serialNumber: optionalClean(updates.serialNumber, "serial number", 120),
      macAddress: validateMacAddress(updates.macAddress),
      ipAddress: validateIpAddress(updates.ipAddress),
      routerPort: optionalClean(updates.routerPort, "router port", 80),
      portCount: validatePortCount(updates.portCount),
      managed: updates.managed,
      note: optionalClean(updates.note, "note", 1000),
      updatedAt: Date.now(),
    };
    await ctx.db.patch(switchId, patch);
    await logAudit(ctx, { action: "networkSwitch.update", entityTable: "networkSwitches", entityId: switchId, changedBy: user._id, before: { name: existing.name }, after: { name: patch.name ?? existing.name, routerPort: patch.routerPort, portCount: patch.portCount } });
  },
});

/** Archive instead of deleting to preserve access-point references. */
export const archiveSwitch = mutation({
  args: { switchId: v.id("networkSwitches"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const existing = await ctx.db.get(args.switchId);
    if (!existing || existing.archivedAt !== undefined) throw new Error("Switch not found");
    const reason = cleanText(args.reason, "archive reason", 300);
    await ctx.db.patch(args.switchId, { archivedAt: Date.now(), archivedBy: user._id, archiveReason: reason, updatedAt: Date.now() });
    await logAudit(ctx, { action: "networkSwitch.archive", entityTable: "networkSwitches", entityId: args.switchId, changedBy: user._id, before: { name: existing.name }, after: { reason } });
  },
});

/** Permanently remove a switch and unbind access points linked to it. */
export const deleteSwitch = mutation({
  args: { switchId: v.id("networkSwitches"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const existing = await ctx.db.get(args.switchId);
    if (!existing) throw new Error("Switch not found");
    const reason = cleanText(args.reason, "delete reason", 300);
    const linked = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", existing.routerId))
      .filter((q) => q.eq(q.field("switchId"), args.switchId))
      .collect();
    await Promise.all(linked.map((ap) => ctx.db.patch(ap._id, { switchId: undefined, switchPort: undefined, updatedAt: Date.now() })));
    await ctx.db.delete(args.switchId);
    await logAudit(ctx, { action: "networkSwitch.delete", entityTable: "networkSwitches", entityId: args.switchId, changedBy: user._id, before: { name: existing.name }, after: { reason, unboundAccessPoints: linked.length } });
  },
});