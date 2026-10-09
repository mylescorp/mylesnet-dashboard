import { v } from "convex/values";
import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import {
  buildFleetRow,
  isProvisioningStatusValue,
  type DeviceProvisioningStatus,
} from "./lib/fleetCore";
import { isValidFirmwareLabel } from "./lib/provisioningCore";
import { canTenantOperate } from "./lib/tenantCore";

const readers = ["platform_super_admin", "platform_ops", "platform_support", "platform_readonly"];
const managers = ["platform_super_admin", "platform_ops"];

async function assertMarketReady(ctx: MutationCtx, marketId: Id<"markets">) {
  const market = await ctx.db.get(marketId);
  if (!market || market.deletedAt !== undefined || market.status === "deleted") throw new Error("Market not found or archived");
  if (market.tenantId) {
    const tenant = await ctx.db.get(market.tenantId);
    if (!tenant || !canTenantOperate(tenant.status)) throw new Error("Cannot manage devices for an unavailable tenant");
  }
  return market;
}

/**
 * Platform device fleet registry (spec B1): every device across every tenant,
 * joined to market + tenant names, with firmware / last-seen / uptime /
 * provisioning posture surfaced for the platform panel.
 *
 * Reads: super-admin, ops, support, readonly. Finance access is excluded by
 * the canonical matrix. Writes are limited to super-admin and ops.
 */
export const listDeviceFleet = query({
  args: {
    paginationOpts: paginationOptsValidator,
    provisioningStatus: v.optional(v.union(v.literal("unprovisioned"), v.literal("pending"), v.literal("provisioned"), v.literal("failed"))),
    includeArchived: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    const query = args.provisioningStatus
      ? ctx.db.query("platformDevices").withIndex("by_provisioningStatus", (q) => q.eq("provisioningStatus", args.provisioningStatus)).order("desc")
      : ctx.db.query("platformDevices").order("desc");
    const page = await query.paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(100, Math.floor(args.paginationOpts.numItems))),
    });
    const devices = args.includeArchived ? page.page : page.page.filter((device) => device.deletedAt === undefined);

    return {
      ...page,
      page: await Promise.all(devices.map(async (device) => {
        const market = await ctx.db.get(device.marketId);
        const resolvedTenantId = device.tenantId ?? market?.tenantId ?? null;
        const tenant = resolvedTenantId ? await ctx.db.get(resolvedTenantId) : null;
        return buildFleetRow(
          {
            _id: device._id,
            tenantId: resolvedTenantId ?? undefined,
            marketId: device.marketId,
            marketName: market?.name ?? null,
            name: device.name,
            deviceKind: device.deviceKind,
            firmwareVersion: device.firmwareVersion,
            lastSeenAt: device.lastSeenAt,
            uptimePercent: device.uptimePercent,
            provisioningStatus: device.provisioningStatus,
            lifecycleStatus: device.lifecycleStatus,
            registeredBy: device.registeredBy ?? null,
            createdAt: device.createdAt,
            deletedAt: device.deletedAt,
          },
          resolvedTenantId,
          tenant?.name ?? null,
        );
      })),
    };
  },
});

export const getDeviceFleetRow = query({
  args: { deviceId: v.id("platformDevices") },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    const device = await ctx.db.get(args.deviceId);
    if (!device) return null;
    const market = await ctx.db.get(device.marketId);
    const resolvedTenantId = device.tenantId ?? market?.tenantId ?? null;
    const tenant = resolvedTenantId ? await ctx.db.get(resolvedTenantId) : null;
    return buildFleetRow(
      {
        _id: device._id,
        tenantId: resolvedTenantId ?? undefined,
        marketId: device.marketId,
        marketName: market?.name ?? null,
        name: device.name,
        deviceKind: device.deviceKind,
        firmwareVersion: device.firmwareVersion,
        lastSeenAt: device.lastSeenAt,
        uptimePercent: device.uptimePercent,
        provisioningStatus: device.provisioningStatus,
        lifecycleStatus: device.lifecycleStatus,
        registeredBy: device.registeredBy ?? null,
        createdAt: device.createdAt,
        deletedAt: device.deletedAt,
      },
      resolvedTenantId,
      tenant?.name ?? null,
    );
  },
});

/**
 * Update firmware / uptime / provisioning posture on a device. Only
 * super_admin and ops per the B1 CRUD matrix. Existing optional fields are
 * left untouched if the caller omits them (partial update).
 */
export const updateDeviceFleetRow = mutation({
  args: {
    deviceId: v.id("platformDevices"),
    name: v.optional(v.string()),
    deviceKind: v.optional(v.string()),
    firmwareVersion: v.optional(v.union(v.string(), v.null())),
    provisioningStatus: v.optional(
      v.union(
        v.literal("unprovisioned"),
        v.literal("pending"),
        v.literal("provisioned"),
        v.literal("failed"),
      ),
    ),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, managers);

    const device = await ctx.db.get(args.deviceId);
    if (!device || device.deletedAt !== undefined) throw new Error("Device not found");
    await assertMarketReady(ctx, device.marketId);

    const name = args.name?.trim();
    const deviceKind = args.deviceKind?.trim();
    if (name !== undefined && (name.length < 2 || name.length > 120)) throw new Error("Device name must be 2–120 characters");
    if (deviceKind !== undefined && (deviceKind.length < 2 || deviceKind.length > 80)) throw new Error("Device model must be 2–80 characters");

    if (args.firmwareVersion !== undefined && args.firmwareVersion !== null && !isValidFirmwareLabel(args.firmwareVersion)) {
      throw new Error("firmwareVersion must be 3-80 characters");
    }
    if (
      args.provisioningStatus !== undefined &&
      !isProvisioningStatusValue(args.provisioningStatus)
    ) {
      throw new Error("Unknown provisioning status value");
    }

    await ctx.db.patch(args.deviceId, {
      ...(name !== undefined ? { name } : {}),
      ...(deviceKind !== undefined ? { deviceKind } : {}),
      ...(args.firmwareVersion !== undefined ? { firmwareVersion: args.firmwareVersion ?? undefined } : {}),
      ...(args.provisioningStatus !== undefined
        ? { provisioningStatus: args.provisioningStatus as DeviceProvisioningStatus }
        : {}),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "fleet.device_updated",
      entityTable: "platformDevices",
      entityId: args.deviceId,
      changedBy: user._id,
      before: { name: device.name, deviceKind: device.deviceKind, firmwareVersion: device.firmwareVersion, provisioningStatus: device.provisioningStatus },
      after: { name: name ?? device.name, deviceKind: deviceKind ?? device.deviceKind, firmwareVersion: args.firmwareVersion === null ? null : args.firmwareVersion ?? device.firmwareVersion, provisioningStatus: args.provisioningStatus ?? device.provisioningStatus },
    });
  },
});

export const listMarketsForFleetManagement = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, managers);
    const page = await ctx.db.query("markets").withIndex("by_tenant").order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(50, Math.floor(args.paginationOpts.numItems))),
    });
    const rows = await Promise.all(page.page.map(async market => {
      if (market.deletedAt !== undefined || market.status === "deleted") return null;
      const tenant = market.tenantId ? await ctx.db.get(market.tenantId) : null;
      if (market.tenantId && (!tenant || !canTenantOperate(tenant.status))) return null;
      return { _id: market._id, name: market.name, tenantId: market.tenantId ?? null };
    }));
    return { ...page, page: rows.filter((row): row is NonNullable<typeof row> => row !== null) };
  },
});

export const registerDevice = mutation({
  args: {
    marketId: v.id("markets"), name: v.string(), deviceKind: v.string(),
    macAddress: v.optional(v.string()), firmwareVersion: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, managers);
    const market = await assertMarketReady(ctx, args.marketId);
    const name = args.name.trim();
    const deviceKind = args.deviceKind.trim();
    const macAddress = args.macAddress?.trim().toUpperCase() || undefined;
    if (name.length < 2 || name.length > 120) throw new Error("Device name must be 2–120 characters");
    if (deviceKind.length < 2 || deviceKind.length > 80) throw new Error("Device model must be 2–80 characters");
    if (args.firmwareVersion !== undefined && !isValidFirmwareLabel(args.firmwareVersion)) throw new Error("Firmware version must be 3–80 characters");
    if (macAddress && !/^([0-9A-F]{2}:){5}[0-9A-F]{2}$/.test(macAddress)) throw new Error("MAC address must use the 00:11:22:33:44:55 format");
    if (macAddress && await ctx.db.query("platformDevices").withIndex("by_macAddress", q => q.eq("macAddress", macAddress)).first()) throw new Error("A device with this MAC address already exists");
    const now = Date.now();
    const deviceId = await ctx.db.insert("platformDevices", {
      tenantId: market.tenantId,
      marketId: market._id,
      name,
      deviceKind,
      firmwareVersion: args.firmwareVersion?.trim(),
      macAddress,
      serialOrMac: macAddress,
      lifecycleStatus: "active",
      status: "active",
      provisioningStatus: "unprovisioned",
      registeredBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, { action: "fleet.device_registered", entityTable: "platformDevices", entityId: deviceId, changedBy: user._id, tenantId: market.tenantId, after: { tenantId: market.tenantId, marketId: market._id, name, deviceKind, firmwareVersion: args.firmwareVersion?.trim(), macAddress } });
    return deviceId;
  },
});

export const archiveDevice = mutation({
  args: { deviceId: v.id("platformDevices"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, managers);
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.deletedAt !== undefined) throw new Error("Device not found or already archived");
    await assertMarketReady(ctx, device.marketId);
    const [pending, approved] = await Promise.all([
      ctx.db.query("provisioningRequests").withIndex("by_device_status", q => q.eq("deviceId", device._id).eq("status", "pending")).first(),
      ctx.db.query("provisioningRequests").withIndex("by_device_status", q => q.eq("deviceId", device._id).eq("status", "approved")).first(),
    ]);
    if (pending || approved) throw new Error("Resolve the open provisioning request before archiving this device");
    const reason = args.reason.trim();
    if (!reason || reason.length > 500) throw new Error("Archive reason must be 1–500 characters");
    const now = Date.now();
    await ctx.db.patch(device._id, { deletedAt: now, deletedBy: user._id, deleteReason: reason, updatedAt: now });
    await logAudit(ctx, { action: "fleet.device_archived", entityTable: "platformDevices", entityId: device._id, changedBy: user._id, before: { deletedAt: device.deletedAt }, after: { deletedAt: now, reason } });
  },
});

export const restoreDevice = mutation({
  args: { deviceId: v.id("platformDevices") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, managers);
    const device = await ctx.db.get(args.deviceId);
    if (!device || device.deletedAt === undefined) throw new Error("Archived device not found");
    await assertMarketReady(ctx, device.marketId);
    const now = Date.now();
    await ctx.db.patch(device._id, { deletedAt: undefined, deletedBy: undefined, deleteReason: undefined, updatedAt: now });
    await logAudit(ctx, { action: "fleet.device_restored", entityTable: "platformDevices", entityId: device._id, changedBy: user._id, before: { deletedAt: device.deletedAt }, after: { deletedAt: null } });
  },
});
