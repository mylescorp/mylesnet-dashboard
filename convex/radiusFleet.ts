import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import {
  buildRadiusServerRow,
  isValidRadiusHostname,
  isValidRadiusPort,
  isRadiusServerProtocol,
  isRadiusServerStatus,
  isRadiusHealthStatus,
  type RadiusServerProtocol,
  type RadiusServerStatus,
  type RadiusHealthStatus,
} from "./lib/radiusFleetCore";

/**
 * Platform RADIUS server fleet registry (spec B3): every shared RADIUS node
 * across the platform, surfaced for the platform control-plane panel.
 *
 * Reads: any platform user. Writes: platform_super_admin or platform_ops
 * per the B3 CRUD matrix.
 */
export const listRadiusServers = query({
  args: {
    status: v.optional(v.string()),
    protocol: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    if (args.status !== undefined && !isRadiusServerStatus(args.status)) {
      throw new Error("Unknown status filter");
    }
    if (args.protocol !== undefined && !isRadiusServerProtocol(args.protocol)) {
      throw new Error("Unknown protocol filter");
    }

    let servers = await ctx.db.query("radiusServers").collect();
    if (args.status !== undefined) {
      servers = servers.filter((s) => s.status === args.status);
    }
    if (args.protocol !== undefined) {
      servers = servers.filter((s) => s.protocol === args.protocol);
    }
    servers.sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0));

    return servers.map((server) =>
      buildRadiusServerRow({
        _id: server._id,
        name: server.name,
        hostname: server.hostname,
        port: server.port,
        protocol: server.protocol,
        status: server.status,
        healthStatus: server.healthStatus,
        region: server.region,
        certExpiryAt: server.certExpiryAt,
        lastHealthCheckAt: server.lastHealthCheckAt,
        notes: server.notes,
        registeredBy: server.registeredBy,
        createdAt: server.createdAt,
      }),
    );
  },
});

export const getRadiusServerRow = query({
  args: { serverId: v.id("radiusServers") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const server = await ctx.db.get(args.serverId);
    if (!server) return null;
    return buildRadiusServerRow({
      _id: server._id,
      name: server.name,
      hostname: server.hostname,
      port: server.port,
      protocol: server.protocol,
      status: server.status,
      healthStatus: server.healthStatus,
      region: server.region,
      certExpiryAt: server.certExpiryAt,
      lastHealthCheckAt: server.lastHealthCheckAt,
      notes: server.notes,
      registeredBy: server.registeredBy,
      createdAt: server.createdAt,
    });
  },
});

/**
 * Register a new shared RADIUS server. Platform-super_admin and platform_ops
 * only per the B3 CRUD matrix.
 */
export const createRadiusServer = mutation({
  args: {
    name: v.string(),
    hostname: v.string(),
    port: v.number(),
    protocol: v.union(v.literal("radsec"), v.literal("udp")),
    region: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    if (!isValidRadiusHostname(args.hostname)) {
      throw new Error("Invalid hostname or IP address");
    }
    if (!isValidRadiusPort(args.port)) {
      throw new Error("Port must be between 1 and 65535");
    }

    const now = Date.now();
    const serverId = await ctx.db.insert("radiusServers", {
      name: args.name,
      hostname: args.hostname,
      port: args.port,
      protocol: args.protocol as RadiusServerProtocol,
      status: "provisioning",
      healthStatus: "unknown",
      region: args.region,
      notes: args.notes,
      registeredBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "radiusServer.create",
      entityTable: "radiusServers",
      entityId: serverId,
      changedBy: user._id,
      after: {
        name: args.name,
        hostname: args.hostname,
        port: args.port,
        protocol: args.protocol,
      },
    });

    return serverId;
  },
});

/**
 * Update a shared RADIUS server. Platform-super_admin and platform_ops only.
 * Existing optional fields are left untouched if the caller omits them.
 */
export const updateRadiusServer = mutation({
  args: {
    serverId: v.id("radiusServers"),
    name: v.optional(v.string()),
    hostname: v.optional(v.string()),
    port: v.optional(v.number()),
    protocol: v.optional(v.union(v.literal("radsec"), v.literal("udp"))),
    status: v.optional(v.string()),
    healthStatus: v.optional(v.string()),
    region: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    const server = await ctx.db.get(args.serverId);
    if (!server) throw new Error("RADIUS server not found");

    if (args.hostname !== undefined && !isValidRadiusHostname(args.hostname)) {
      throw new Error("Invalid hostname or IP address");
    }
    if (args.port !== undefined && !isValidRadiusPort(args.port)) {
      throw new Error("Port must be between 1 and 65535");
    }
    if (args.status !== undefined && !isRadiusServerStatus(args.status)) {
      throw new Error("Unknown status value");
    }
    if (args.healthStatus !== undefined && !isRadiusHealthStatus(args.healthStatus)) {
      throw new Error("Unknown health status value");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.hostname !== undefined) patch.hostname = args.hostname;
    if (args.port !== undefined) patch.port = args.port;
    if (args.protocol !== undefined) patch.protocol = args.protocol;
    if (args.status !== undefined) patch.status = args.status as RadiusServerStatus;
    if (args.healthStatus !== undefined) patch.healthStatus = args.healthStatus as RadiusHealthStatus;
    if (args.region !== undefined) patch.region = args.region;
    if (args.notes !== undefined) patch.notes = args.notes;

    await ctx.db.patch(args.serverId, patch);

    await logAudit(ctx, {
      action: "radiusServer.update",
      entityTable: "radiusServers",
      entityId: args.serverId,
      changedBy: user._id,
      after: {
        name: args.name,
        hostname: args.hostname,
        port: args.port,
        protocol: args.protocol,
        status: args.status,
        healthStatus: args.healthStatus,
      },
    });
  },
});

/**
 * Decommission (soft-delete) a RADIUS server. Only platform_super_admin may
 * remove nodes from the fleet; ops can manage but not remove.
 */
export const deleteRadiusServer = mutation({
  args: {
    serverId: v.id("radiusServers"),
    deleteReason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
    ]);

    const server = await ctx.db.get(args.serverId);
    if (!server) throw new Error("RADIUS server not found");

    await ctx.db.patch(args.serverId, {
      status: "decommissioned",
      notes: server.notes
        ? `${server.notes}\n\nDecommissioned: ${args.deleteReason}`
        : `Decommissioned: ${args.deleteReason}`,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "radiusServer.decommissioned",
      entityTable: "radiusServers",
      entityId: args.serverId,
      changedBy: user._id,
      after: { deleteReason: args.deleteReason },
    });
  },
});
