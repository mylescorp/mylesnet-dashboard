import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { PLATFORM_OPERATE_SUB_ROLES, PLATFORM_READ_SUB_ROLES, PLATFORM_SUPER_ADMIN_SUB_ROLES } from "./lib/platformAccess";
import { logAudit } from "./lib/auditLog";
import {
  canRetryProvisioning,
  isValidFirmwareLabel,
  normalizeProvisioningError,
  normalizeProvisioningTransition,
  retryProvisioningStatus,
} from "./lib/provisioningCore";
import { canTenantOperate } from "./lib/tenantCore";

const readers = PLATFORM_READ_SUB_ROLES;
const managers = PLATFORM_OPERATE_SUB_ROLES;

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
          retryCount: row.retryCount ?? 0,
          recoveryState: row.recoveryState ?? "idle",
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
      retryCount: row.retryCount ?? 0,
      recoveryState: row.recoveryState ?? "idle",
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
      const existing = await ctx.db.query("provisioningRequests").withIndex("by_device_status", q => q.eq("deviceId", args.deviceId!).eq("status", "pending")).first();
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
      retryCount: 0,
      recoveryState: "idle",
      lastTransitionAt: now,
    });

    if (device) {
      await ctx.db.patch(device._id, { provisioningStatus: "pending", updatedAt: now });
      await logAudit(ctx, {
        action: "fleet.device_provisioning_requested",
        entityTable: "platformDevices",
        entityId: device._id,
        changedBy: user._id,
        tenantId: device?.tenantId ?? market.tenantId ?? null,
        before: { provisioningStatus: device.provisioningStatus ?? "unprovisioned" },
        after: { provisioningStatus: "pending", requestId },
      });
    }

    await logAudit(ctx, {
      action: "provisioning.requested",
      entityTable: "provisioningRequests",
      entityId: requestId,
      changedBy: user._id,
      tenantId: tenantId ?? null,
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

    const next = normalizeProvisioningTransition(request.status, args.decision);
    if (next === null) {
      throw new Error(`Cannot change a ${request.status} request to ${args.decision}`);
    }

    // Idempotent no-op: a repeated decision for a request already in that state
    // succeeds without rewriting history or duplicating audit entries.
    if (next === request.status) return;

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
      lastTransitionAt: now,
      // Approval keeps a retried request in "retrying" until its verified
      // deployment completes; it only reports "recovered" then.
      recoveryState: next === "approved" && (request.retryCount ?? 0) > 0 ? "retrying" : "idle",
      lastError: undefined,
    });

    if (device) {
      const provisioningStatus = args.decision === "rejected" ? "failed" : "pending";
      await ctx.db.patch(device._id, { provisioningStatus, updatedAt: now });
      await logAudit(ctx, {
        action: "fleet.device_provisioning_decision",
        entityTable: "platformDevices",
        entityId: device._id,
        changedBy: user._id,
        tenantId: device?.tenantId ?? request.tenantId ?? null,
        before: { provisioningStatus: device.provisioningStatus ?? "unprovisioned" },
        after: { provisioningStatus, requestId: args.requestId, decision: args.decision },
      });
    }

    await logAudit(ctx, {
      action: args.decision === "approved" ? "provisioning.approved" : "provisioning.rejected",
      entityTable: "provisioningRequests",
      entityId: args.requestId,
      changedBy: user._id,
      tenantId: request.tenantId ?? null,
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

    const next = normalizeProvisioningTransition(request.status, "deployed");
    if (next === null) {
      throw new Error(`Only an approved request can be marked deployed (was ${request.status})`);
    }

    // Idempotent no-op: recording the same verified deployment twice must not
    // duplicate audit entries or overwrite the recorded timestamp.
    if (next === request.status) return;

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
      lastAttemptAt: now,
      lastTransitionAt: now,
      // A request that had to be retried reports "recovered" once its verified
      // deployment finally lands.
      recoveryState: (request.retryCount ?? 0) > 0 ? "recovered" : "idle",
      lastError: undefined,
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
        tenantId: device?.tenantId ?? request.tenantId ?? null,
        before: { provisioningStatus: device.provisioningStatus ?? "unprovisioned", firmwareVersion: device.firmwareVersion ?? null },
        after: { provisioningStatus: "provisioned", firmwareVersion: request.requestedFirmware ?? device.firmwareVersion ?? null, requestId: args.requestId },
      });
    }

    await logAudit(ctx, {
      action: "provisioning.deployed",
      entityTable: "provisioningRequests",
      entityId: args.requestId,
      changedBy: user._id,
      tenantId: request.tenantId ?? null,
      before: { status: request.status },
      after: { status: next },
    });
  },
});

/**
 * Retry a rejected provisioning request. The request returns to the pending
 * queue for a fresh decision while its retry history is preserved for audit.
 * Recovery preconditions (a still-operable market/tenant and linked device) are
 * checked up front; a failed precondition is recorded durably on the row and
 * reported back to the caller instead of being silently discarded.
 */
export const retryProvisioningRequest = mutation({
  args: { requestId: v.id("provisioningRequests") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, managers);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Provisioning request not found");

    const next = retryProvisioningStatus(request.status);
    if (next === null || !canRetryProvisioning(request.status)) {
      return { ok: false as const, reason: "not_retryable" as const };
    }

    const now = Date.now();
    const retryCount = (request.retryCount ?? 0) + 1;

    const market = await ctx.db.get(request.marketId);
    const tenant = market?.tenantId ? await ctx.db.get(market.tenantId) : null;
    const marketUnavailable =
      !market ||
      market.deletedAt !== undefined ||
      (market.tenantId !== undefined && (!tenant || !canTenantOperate(tenant.status)));
    const device = request.deviceId ? await ctx.db.get(request.deviceId) : null;
    const deviceUnavailable = request.deviceId !== undefined && (!device || device.deletedAt !== undefined);
    // A retry must not resurrect a request whose device has since gained a
    // different pending request; that would put one device in two open queues.
    const conflicting =
      request.deviceId !== undefined
        ? await ctx.db.query("provisioningRequests").withIndex("by_device_status", q => q.eq("deviceId", request.deviceId!).eq("status", "pending")).first()
        : null;

    const failure = conflicting
      ? { reason: "This device already has another open provisioning request", outcome: "conflict" as const }
      : deviceUnavailable
        ? { reason: "The linked device is missing or archived", outcome: "unavailable" as const }
        : marketUnavailable
          ? { reason: "The market or tenant is unavailable", outcome: "unavailable" as const }
          : null;

    if (failure) {
      await ctx.db.patch(args.requestId, {
        retryCount,
        lastRetryAt: now,
        lastAttemptAt: now,
        lastError: normalizeProvisioningError(failure.reason) ?? undefined,
        recoveryState: "failed",
        updatedAt: now,
      });
      await logAudit(ctx, {
        action: "provisioning.retry_failed",
        entityTable: "provisioningRequests",
        entityId: args.requestId,
        changedBy: user._id,
        tenantId: request.tenantId ?? null,
        before: { status: request.status, retryCount: request.retryCount ?? 0 },
        after: { status: request.status, retryCount, reason: failure.reason },
      });
      return { ok: false as const, reason: failure.outcome };
    }

    await ctx.db.patch(args.requestId, {
      status: next,
      decidedBy: undefined,
      decidedAt: undefined,
      decisionNote: undefined,
      retryCount,
      lastRetryAt: now,
      lastAttemptAt: now,
      lastError: undefined,
      recoveryState: "retrying",
      lastTransitionAt: now,
      updatedAt: now,
    });

    if (device) {
      await ctx.db.patch(device._id, { provisioningStatus: "pending", updatedAt: now });
      await logAudit(ctx, {
        action: "fleet.device_provisioning_retried",
        entityTable: "platformDevices",
        entityId: device._id,
        changedBy: user._id,
        tenantId: device?.tenantId ?? request.tenantId ?? null,
        before: { provisioningStatus: device.provisioningStatus ?? "unprovisioned" },
        after: { provisioningStatus: "pending", requestId: args.requestId, retryCount },
      });
    }

    await logAudit(ctx, {
      action: "provisioning.retried",
      entityTable: "provisioningRequests",
      entityId: args.requestId,
      changedBy: user._id,
      tenantId: request.tenantId ?? null,
      before: { status: request.status, retryCount: request.retryCount ?? 0 },
      after: { status: next, retryCount },
    });
    return { ok: true as const, retryCount };
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
    const actor = await requirePlatformSubRole(ctx, PLATFORM_SUPER_ADMIN_SUB_ROLES);
    const request = await ctx.db.get(args.requestId);
    if (!request) throw new Error("Provisioning request not found");
    if (request.status === "pending" || request.status === "approved") throw new Error("Only rejected or deployed requests may be deleted");
    await ctx.db.delete(request._id);
    await logAudit(ctx, { action: "provisioning.deleted", entityTable: "provisioningRequests", entityId: request._id, changedBy: actor._id, tenantId: request.tenantId ?? null, before: { status: request.status, marketId: request.marketId, deviceId: request.deviceId ?? null } });
  },
});
