import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import {
  buildFleetRow,
  isProvisioningStatusValue,
  isUptimePercentValid,
  type DeviceProvisioningStatus,
} from "./lib/fleetCore";
import { isValidFirmwareLabel } from "./lib/provisioningCore";

/**
 * Platform device fleet registry (spec B1): every device across every tenant,
 * joined to market + tenant names, with firmware / last-seen / uptime /
 * provisioning posture surfaced for the platform panel.
 *
 * Reads: any platform user. Updates to fleet fields: platform_super_admin or
 * platform_ops, per the spec's CRUD matrix.
 */
export const listDeviceFleet = query({
  args: {
    marketId: v.optional(v.id("markets")),
    provisioningStatus: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    if (
      args.provisioningStatus !== undefined &&
      !isProvisioningStatusValue(args.provisioningStatus)
    ) {
      throw new Error("Unknown provisioning status filter");
    }

    let devices = await ctx.db.query("devices").collect();
    if (args.marketId !== undefined) {
      devices = devices.filter((d) => d.marketId === args.marketId);
    }
    if (args.provisioningStatus !== undefined) {
      devices = devices.filter((d) => d.provisioningStatus === args.provisioningStatus);
    }
    devices.sort((a, b) => (b.lastSeenAt ?? b.createdAt) - (a.lastSeenAt ?? a.createdAt));

    const marketName = new Map<string, string>();
    const marketTenant = new Map<string, string | null>();
    for (const market of await ctx.db.query("markets").collect()) {
      marketName.set(market._id, market.name);
      marketTenant.set(market._id, market.tenantId ?? null);
    }
    const tenantName = new Map<string, string | null>();
    for (const tenant of await ctx.db.query("tenants").collect()) {
      tenantName.set(tenant._id, tenant.name);
    }

    return Promise.all(
      devices.map(async (device) => {
        const resolvedTenantId =
          device.tenantId ?? marketTenant.get(device.marketId) ?? null;
        return buildFleetRow(
          {
            _id: device._id,
            tenantId: resolvedTenantId ?? undefined,
            marketId: device.marketId,
            marketName: marketName.get(device.marketId) ?? null,
            name: device.name,
            deviceKind: device.deviceKind,
            firmwareVersion: device.firmwareVersion,
            lastSeenAt: device.lastSeenAt,
            uptimePercent: device.uptimePercent,
            provisioningStatus: device.provisioningStatus,
            lifecycleStatus: device.lifecycleStatus,
            registeredBy: device.registeredBy ?? null,
            createdAt: device.createdAt,
          },
          resolvedTenantId,
          resolvedTenantId ? (tenantName.get(resolvedTenantId) ?? null) : null,
        );
      }),
    );
  },
});

export const getDeviceFleetRow = query({
  args: { deviceId: v.id("devices") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
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
    deviceId: v.id("devices"),
    firmwareVersion: v.optional(v.string()),
    uptimePercent: v.optional(v.number()),
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
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    const device = await ctx.db.get(args.deviceId);
    if (!device) throw new Error("Device not found");

    if (args.firmwareVersion !== undefined && !isValidFirmwareLabel(args.firmwareVersion)) {
      throw new Error("firmwareVersion must be 3-80 characters");
    }
    if (args.uptimePercent !== undefined && !isUptimePercentValid(args.uptimePercent)) {
      throw new Error("uptimePercent must be a number between 0 and 100");
    }
    if (
      args.provisioningStatus !== undefined &&
      !isProvisioningStatusValue(args.provisioningStatus)
    ) {
      throw new Error("Unknown provisioning status value");
    }

    await ctx.db.patch(args.deviceId, {
      ...(args.firmwareVersion !== undefined ? { firmwareVersion: args.firmwareVersion } : {}),
      ...(args.uptimePercent !== undefined ? { uptimePercent: args.uptimePercent } : {}),
      ...(args.provisioningStatus !== undefined
        ? { provisioningStatus: args.provisioningStatus as DeviceProvisioningStatus }
        : {}),
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "fleet.device_updated",
      entityTable: "devices",
      entityId: args.deviceId,
      changedBy: user._id,
      after: {
        firmwareVersion: args.firmwareVersion,
        uptimePercent: args.uptimePercent,
        provisioningStatus: args.provisioningStatus,
      },
    });
  },
});