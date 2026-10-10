import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requirePlatformSubRole, resolveRoles } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { validatePlatformRadiusInput, type PlatformRadiusInput } from "./lib/platformRadiusCore";

const lifecycle = v.union(v.literal("planned"), v.literal("active"), v.literal("degraded"), v.literal("maintenance"), v.literal("retired"));
const transport = v.union(v.literal("udp"), v.literal("tcp"), v.literal("tls"));
const writeRoles = ["platform_super_admin", "platform_ops"];
const readRoles = [...writeRoles, "platform_finance", "platform_support", "platform_readonly"];

function toRow(server: Doc<"platformRadiusServers">, includeConnectionDetails: boolean) {
  return {
    _id: server._id, name: server.name, hostname: includeConnectionDetails ? server.hostname : null, region: server.region,
    authPort: includeConnectionDetails ? server.authPort : null, accountingPort: includeConnectionDetails ? server.accountingPort : null,
    transport: includeConnectionDetails ? server.transport : null,
    softwareVersion: includeConnectionDetails ? server.softwareVersion ?? null : null, lifecycleStatus: server.lifecycleStatus,
    capacitySessions: server.capacitySessions ?? null, uptimePercent: server.uptimePercent ?? null,
    latencyMs: server.latencyMs ?? null, activeSessions: server.activeSessions ?? null,
    authSuccessPercent: server.authSuccessPercent ?? null, authFailurePercent: server.authFailurePercent ?? null,
    metricsObservedAt: server.metricsObservedAt ?? null, createdAt: server.createdAt, updatedAt: server.updatedAt,
    archivedAt: server.archivedAt ?? null, archiveReason: server.archiveReason ?? null,
  };
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator, includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, readRoles);
    const roles = await resolveRoles(ctx, user);
    const includeConnectionDetails = roles.some(role => ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug));
    const page = await ctx.db.query("platformRadiusServers").withIndex("by_createdAt").order("desc").paginate({
      ...args.paginationOpts, numItems: Math.min(50, Math.max(1, Math.floor(args.paginationOpts.numItems))),
    });
    return { ...page, page: page.page.filter(row => args.includeArchived || row.archivedAt === undefined).map(row => toRow(row, includeConnectionDetails)) };
  },
});

export const get = query({
  args: { serverId: v.id("platformRadiusServers") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, readRoles);
    const roles = await resolveRoles(ctx, user);
    const includeConnectionDetails = roles.some(role => ["platform_owner", "platform_admin", "ops_manager"].includes(role.slug));
    const server = await ctx.db.get(args.serverId);
    return server ? toRow(server, includeConnectionDetails) : null;
  },
});

export const create = mutation({
  args: {
    name: v.string(), hostname: v.string(), region: v.string(), authPort: v.number(), accountingPort: v.number(),
    transport, softwareVersion: v.optional(v.string()), lifecycleStatus: lifecycle, capacitySessions: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, writeRoles);
    const input = validatePlatformRadiusInput(args as PlatformRadiusInput);
    const now = Date.now();
    const serverId = await ctx.db.insert("platformRadiusServers", { ...input, createdBy: user._id, createdAt: now, updatedBy: user._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.radiusServer.created", entityTable: "platformRadiusServers", entityId: serverId, changedBy: user._id, after: { ...input } });
    return serverId;
  },
});

export const update = mutation({
  args: {
    serverId: v.id("platformRadiusServers"), name: v.optional(v.string()), hostname: v.optional(v.string()),
    region: v.optional(v.string()), authPort: v.optional(v.number()), accountingPort: v.optional(v.number()),
    transport: v.optional(transport), softwareVersion: v.optional(v.union(v.string(), v.null())),
    lifecycleStatus: v.optional(lifecycle), capacitySessions: v.optional(v.union(v.number(), v.null())),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, writeRoles);
    const server = await ctx.db.get(args.serverId);
    if (!server || server.archivedAt !== undefined) throw new Error("RADIUS server not found");
    const effective: PlatformRadiusInput = {
      name: args.name ?? server.name, hostname: args.hostname ?? server.hostname, region: args.region ?? server.region,
      authPort: args.authPort ?? server.authPort, accountingPort: args.accountingPort ?? server.accountingPort,
      transport: args.transport ?? server.transport, softwareVersion: args.softwareVersion === null ? undefined : args.softwareVersion ?? server.softwareVersion,
      lifecycleStatus: args.lifecycleStatus ?? server.lifecycleStatus, capacitySessions: args.capacitySessions === null ? undefined : args.capacitySessions ?? server.capacitySessions,
    };
    const normalized = validatePlatformRadiusInput(effective);
    const patch: Partial<Doc<"platformRadiusServers">> = { ...normalized, updatedBy: user._id, updatedAt: Date.now() };
    if (args.softwareVersion === null) patch.softwareVersion = undefined;
    if (args.capacitySessions === null) patch.capacitySessions = undefined;
    await ctx.db.patch(server._id, patch);
    await logAudit(ctx, { action: "platform.radiusServer.updated", entityTable: "platformRadiusServers", entityId: server._id, changedBy: user._id, before: { name: server.name, hostname: server.hostname, region: server.region, authPort: server.authPort, accountingPort: server.accountingPort, transport: server.transport, lifecycleStatus: server.lifecycleStatus }, after: { name: normalized.name, hostname: normalized.hostname, region: normalized.region, authPort: normalized.authPort, accountingPort: normalized.accountingPort, transport: normalized.transport, lifecycleStatus: normalized.lifecycleStatus } });
    return { updated: true };
  },
});

export const archive = mutation({
  args: { serverId: v.id("platformRadiusServers"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, writeRoles);
    const server = await ctx.db.get(args.serverId);
    if (!server || server.archivedAt !== undefined) throw new Error("RADIUS server not found");
    const reason = args.reason.trim();
    if (reason.length < 8 || reason.length > 500) throw new Error("Provide an archive reason between 8 and 500 characters");
    const now = Date.now();
    await ctx.db.patch(server._id, { archivedAt: now, archivedBy: user._id, archiveReason: reason, updatedBy: user._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.radiusServer.archived", entityTable: "platformRadiusServers", entityId: server._id, changedBy: user._id, before: { lifecycleStatus: server.lifecycleStatus }, after: { archivedAt: now } });
    return { archived: true };
  },
});

export const restore = mutation({
  args: { serverId: v.id("platformRadiusServers") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, writeRoles);
    const server = await ctx.db.get(args.serverId);
    if (!server || server.archivedAt === undefined) throw new Error("Archived RADIUS server not found");
    const now = Date.now();
    await ctx.db.patch(server._id, { archivedAt: undefined, archivedBy: undefined, archiveReason: undefined, updatedBy: user._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.radiusServer.restored", entityTable: "platformRadiusServers", entityId: server._id, changedBy: user._id, after: { restoredAt: now } });
    return { restored: true };
  },
});
