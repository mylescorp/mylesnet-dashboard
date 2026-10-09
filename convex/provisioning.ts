import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { nextProvisioningStatus, isValidFirmwareLabel } from "./lib/provisioningCore";
import { canTenantOperate } from "./lib/tenantCore";

const readers = ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"];
const managers = ["platform_super_admin", "platform_ops"];

const provisioningStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("deployed"),
);

/** Platform view of the device provisioning queue (spec B2). */
export const listProvisioningRequests = query({
  args: { paginationOpts: paginationOptsValidator, status: v.optional(provisioningStatus), marketId: v.optional(v.id("markets")) },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    let query = ctx.db.query("provisioningRequests").withIndex("by_requestedAt").order("desc");
    if (args.marketId && args.status) {
      query = ctx.db.query("provisioningRequests").withIndex("by_market_status_requestedAt", q => q.eq("marketId", args.marketId!).eq("status", args.status!)).order("desc");
    } else if (args.marketId) {
      query = ctx.db.query("provisioningRequests").withIndex("by_market_requestedAt", q => q.eq("marketId", args.marketId!)).order("desc");
    } else if (args.status) {
      query = ctx.db.query("provisioningRequests").withIndex("by_status_requestedAt", q => q.eq("status", args.status!)).order("desc");
    }
    const page = await query.paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(100, Math.floor(args.paginationOpts.numItems))) });
    const rows = await Promise.all(
      page.page.map(async (row) => {
        const [requester, decider, market] = await Promise.all([
          ctx.db.get(row.requesterId),
          row.decidedBy ? ctx.db.get(row.decidedBy) : null,
          ctx.db.get(row.marketId),
        ]);
        const tenant = market?.tenantId ? await ctx.db.get(market.tenantId) : null;
        return {
          ...row,
          requesterName: requester?.name ?? requester?.email ?? null,
          decidedByName: decider?.name ?? decider?.email ?? null,
          marketName: market?.name ?? null,
          tenantName: tenant?.name ?? null,
        };
      }),
    );
    return { ...page, page: rows };
  },
});

/** Single provisioning request (spec B2 detail view). */
export const getProvisioningRequest = query({
  args: { requestId: v.id("provisioningRequests") },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    const row = await ctx.db.get(args.requestId);
    if (!row) return null;
    const [requester, decider, market] = await Promise.all([
      ctx.db.get(row.requesterId),
      row.decidedBy ? ctx.db.get(row.decidedBy) : null,
      ctx.db.get(row.marketId),
    ]);
    const tenant = market?.tenantId ? await ctx.db.get(market.tenantId) : null;
    return {
      ...row,
      requesterName: requester?.name ?? requester?.email ?? null,
      decidedByName: decider?.name ?? decider?.email ?? null,
      marketName: market?.name ?? null,
      tenantName: tenant?.name ?? null,
    };
  },
});

/**
 * Open a provisioning request for a self-registered device. The device stays
 * outside the managed estate until a super_admin or ops role approves it.
 */
export const requestDeviceProvisioning = mutation({
  args: {
    marketId: v.id("markets"),
    deviceId: v.optional(v.id("platformDevices")),
    requestedFirmware: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, managers);
    if (args.requestedFirmware !== undefined && !isValidFirmwareLabel(args.requestedFirmware)) {
      throw new Error("requestedFirmware must be 3-80 characters");
    }

    const market = await ctx.db.get(args.marketId);
    if (!market || market.deletedAt !== undefined || market.status === "deleted") throw new Error("Market not found or archived");
    if (market.tenantId) {
      const tenant = await ctx.db.get(market.tenantId);
      if (!tenant || !canTenantOperate(tenant.status)) throw new Error("Cannot provision devices for an unavailable tenant");
    }

    let device = null;
    if (args.deviceId !== undefined) {
      device = await ctx.db.get(args.deviceId);
      if (!device || device.deletedAt !== undefined) throw new Error("Device not found or archived");
      if (device.marketId !== args.marketId) {
        throw new Error("Device does not belong to the given market");
      }
      if (device.tenantId && market.tenantId && device.tenantId !== market.tenantId) {
        throw new Error("Device and market belong to different tenants");
      }
      const [pending, approved] = await Promise.all([
        ctx.db.query("provisioningRequests").withIndex("by_device_status", q => q.eq("deviceId", args.deviceId!).eq("status", "pending")).first(),
        ctx.db.query("provisioningRequests").withIndex("by_device_status", q => q.eq("deviceId", args.deviceId!).eq("status", "approved")).first(),
      ]);
      if (pending || approved) throw new Error("This device already has an open provisioning request");
    }

    const now = Date.now();
    const tenantId =
      device?.tenantId !== undefined
        ? device.tenantId
        : market.tenantId !== undefined
          ? market.tenantId
          : undefined;

    const requestId = await ctx.db.insert("provisioningRequests", {
      tenantId,
      marketId: args.marketId,
      deviceId: args.deviceId,
      requestedFirmware: args.requestedFirmware,
      requesterId: user._id,
      requestedAt: now,
      status: "pending",
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    if (device) {
      await ctx.db.patch(device._id, { provisioningStatus: "pending", updatedAt: now });
      await logAudit(ctx, {
        action: "fleet.device_provisioning_requested",
        entityTable: "platformDevices",
        entityId: device._id,
        changedBy: user._id,
        before: { provisioningStatus: device.provisioningStatus ?? "unprovisioned" },
        after: { provisioningStatus: "pending", requestId },
      });
    }

    await logAudit(ctx, {
      action: "provisioning.requested",
      entityTable: "provisioningRequests",
      entityId: requestId,
      changedBy: user._id,
      after: {
        marketId: args.marketId,
        deviceId: args.deviceId,
        requestedFirmware: args.requestedFirmware,
      },
    });
    return requestId;
  },
});

/**
 * Approve or reject a pending provisioning request. Only a pending request
 * may be decided. Rejection records an optional note for the requester.
 */
export const decideProvisioningRequest = mutation({
  args: {
    requestId: v.id("provisioningRequests"),
    decision: v.union(v.literal("approved"), v.literal("rejected")),
    note: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, managers);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Provisioning request not found");

    const device = request.deviceId ? await ctx.db.get(request.deviceId) : null;
    if (request.deviceId && (!device || device.deletedAt !== undefined)) {
      throw new Error("The linked device is missing or archived");
    }
    if (args.decision === "approved") {
      const market = await ctx.db.get(request.marketId);
      const tenant = market?.tenantId ? await ctx.db.get(market.tenantId) : null;
      if (!market || market.deletedAt !== undefined || (market.tenantId && (!tenant || !canTenantOperate(tenant.status)))) {
        throw new Error("Cannot approve provisioning for an unavailable market or tenant");
      }
    }

    const next = nextProvisioningStatus(request.status, args.decision);
    if (next === null) {
      throw new Error(`Cannot change a ${request.status} request to ${args.decision}`);
    }

    const note = args.note?.trim();
    if (note && note.length > 500) throw new Error("Decision note must be at most 500 characters");
    if (args.decision === "rejected" && !note) throw new Error("A reason is required when rejecting a request");

    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: next,
      decidedBy: user._id,
      decidedAt: now,
      decisionNote: note,
      updatedAt: now,
    });

    if (device) {
      const provisioningStatus = args.decision === "rejected" ? "failed" : "pending";
      await ctx.db.patch(device._id, { provisioningStatus, updatedAt: now });
      await logAudit(ctx, {
        action: "fleet.device_provisioning_decision",
        entityTable: "platformDevices",
        entityId: device._id,
        changedBy: user._id,
        before: { provisioningStatus: device.provisioningStatus ?? "unprovisioned" },
        after: { provisioningStatus, requestId: args.requestId, decision: args.decision },
      });
    }

    await logAudit(ctx, {
      action: args.decision === "approved" ? "provisioning.approved" : "provisioning.rejected",
      entityTable: "provisioningRequests",
      entityId: args.requestId,
      changedBy: user._id,
      before: { status: request.status },
      after: { status: next, note },
    });
  },
});

/**
 * Record an operator-verified deployment after the device action is completed
 * by an external worker or network tool. This records operator attestation;
 * it is not a telemetry receipt. Legal only from approved.
 */
export const markProvisioningDeployed = mutation({
  args: { requestId: v.id("provisioningRequests") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, managers);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Provisioning request not found");

    const next = nextProvisioningStatus(request.status, "deployed");
    if (next === null) {
      throw new Error(`Only an approved request can be marked deployed (was ${request.status})`);
    }

    const device = request.deviceId ? await ctx.db.get(request.deviceId) : null;
    if (request.deviceId && (!device || device.deletedAt !== undefined)) {
      throw new Error("The linked device is missing or archived");
    }
    const market = await ctx.db.get(request.marketId);
    const tenant = market?.tenantId ? await ctx.db.get(market.tenantId) : null;
    if (!market || market.deletedAt !== undefined || (market.tenantId && (!tenant || !canTenantOperate(tenant.status)))) {
      throw new Error("Cannot record deployment for an unavailable market or tenant");
    }

    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: next,
      decidedAt: now,
      updatedAt: now,
    });

    if (device) {
      await ctx.db.patch(device._id, {
        provisioningStatus: "provisioned",
        ...(request.requestedFirmware ? { firmwareVersion: request.requestedFirmware } : {}),
        updatedAt: now,
      });
      await logAudit(ctx, {
        action: "fleet.device_provisioning_verified",
        entityTable: "platformDevices",
        entityId: device._id,
        changedBy: user._id,
        before: { provisioningStatus: device.provisioningStatus ?? "unprovisioned", firmwareVersion: device.firmwareVersion ?? null },
        after: { provisioningStatus: "provisioned", firmwareVersion: request.requestedFirmware ?? device.firmwareVersion ?? null, requestId: args.requestId },
      });
    }

    await logAudit(ctx, {
      action: "provisioning.deployed",
      entityTable: "provisioningRequests",
      entityId: args.requestId,
      changedBy: user._id,
      before: { status: request.status },
      after: { status: next },
    });
  },
});

export const listMarketsForQueue = query({
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
      return { _id: market._id, name: market.name, tenantId: market.tenantId ?? null, tenantName: tenant?.name ?? null };
    }));
    return { ...page, page: rows.filter((row): row is NonNullable<typeof row> => row !== null) };
  },
});

export const deleteProvisioningRequest = mutation({
  args: { requestId: v.id("provisioningRequests") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Provisioning request not found");
    if (request.status === "pending" || request.status === "approved") throw new Error("Only rejected or deployed requests may be deleted");
    await ctx.db.delete(request._id);
    await logAudit(ctx, { action: "provisioning.deleted", entityTable: "provisioningRequests", entityId: request._id, changedBy: actor._id, before: { status: request.status, marketId: request.marketId, deviceId: request.deviceId ?? null } });
  },
});
