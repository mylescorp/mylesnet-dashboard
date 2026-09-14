import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { nextProvisioningStatus, isValidFirmwareLabel } from "./lib/provisioningCore";

const provisioningStatus = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("deployed"),
);

/** Platform view of the device provisioning queue (spec B2). */
export const listProvisioningRequests = query({
  args: { status: v.optional(provisioningStatus), marketId: v.optional(v.id("markets")) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "provisioning:read");
    let rows = await ctx.db.query("provisioningRequests").collect();
    if (args.status !== undefined) {
      rows = rows.filter((r) => r.status === args.status);
    }
    if (args.marketId !== undefined) {
      rows = rows.filter((r) => r.marketId === args.marketId);
    }
    rows.sort((a, b) => b.requestedAt - a.requestedAt);
    return Promise.all(
      rows.map(async (row) => {
        const requester = row.requesterId ? await ctx.db.get(row.requesterId) : null;
        const decider = row.decidedBy ? await ctx.db.get(row.decidedBy) : null;
        return {
          ...row,
          requesterName: requester?.name ?? requester?.email ?? null,
          decidedByName: decider?.name ?? decider?.email ?? null,
        };
      }),
    );
  },
});

/** Single provisioning request (spec B2 detail view). */
export const getProvisioningRequest = query({
  args: { requestId: v.id("provisioningRequests") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "provisioning:read");
    const row = await ctx.db.get(args.requestId);
    if (!row) return null;
    const requester = row.requesterId ? await ctx.db.get(row.requesterId) : null;
    const decider = row.decidedBy ? await ctx.db.get(row.decidedBy) : null;
    return {
      ...row,
      requesterName: requester?.name ?? requester?.email ?? null,
      decidedByName: decider?.name ?? decider?.email ?? null,
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
    deviceId: v.optional(v.id("devices")),
    requestedFirmware: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "provisioning:manage");
    if (args.requestedFirmware !== undefined && !isValidFirmwareLabel(args.requestedFirmware)) {
      throw new Error("requestedFirmware must be 3-80 characters");
    }

    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");

    let device = null;
    if (args.deviceId !== undefined) {
      device = await ctx.db.get(args.deviceId);
      if (!device) throw new Error("Device not found");
      if (device.marketId !== args.marketId) {
        throw new Error("Device does not belong to the given market");
      }
      const existing = await ctx.db
        .query("provisioningRequests")
        .filter((r) =>
          r.and(
            r.eq(r.field("deviceId"), args.deviceId!),
            r.eq(r.field("status"), "pending"),
          ),
        )
        .first();
      if (existing) throw new Error("This device already has a pending provisioning request");
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
    const user = await requirePermission(ctx, "provisioning:manage");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Provisioning request not found");

    const next = nextProvisioningStatus(request.status, args.decision);
    if (next === null) {
      throw new Error(`Cannot change a ${request.status} request to ${args.decision}`);
    }

    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: next,
      decidedBy: user._id,
      decidedAt: now,
      decisionNote: args.note,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: args.decision === "approved" ? "provisioning.approved" : "provisioning.rejected",
      entityTable: "provisioningRequests",
      entityId: args.requestId,
      changedBy: user._id,
      before: { status: request.status },
      after: { status: next, note: args.note },
    });
  },
});

/**
 * Mark an approved request as deployed once the device reports back
 * provisioned. Legal only from approved; drives the spec lifecycle
 * pending → approved → deployed.
 */
export const markProvisioningDeployed = mutation({
  args: { requestId: v.id("provisioningRequests") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "provisioning:manage");
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Provisioning request not found");

    const next = nextProvisioningStatus(request.status, "deployed");
    if (next === null) {
      throw new Error(`Only an approved request can be marked deployed (was ${request.status})`);
    }

    const now = Date.now();
    await ctx.db.patch(args.requestId, {
      status: next,
      decidedAt: now,
      updatedAt: now,
    });

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
