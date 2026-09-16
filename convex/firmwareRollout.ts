import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { isValidFirmwareLabel } from "./lib/provisioningCore";
import {
  buildFirmwareRolloutRow,
  devicesForNextWave,
  firmwareRolloutMatchesDevice,
  isFirmwareRolloutStatus,
  isRolloutLive,
  nextRolloutStatus,
  resolveRolloutScope,
  type FirmwareRolloutScope,
  type FirmwareRolloutStatus,
} from "./lib/firmwareRolloutCore";

/**
 * Staged firmware rollout campaigns (spec B6): an operator campaigns one
 * firmware label across a bounded scope of the B1 fleet — by market, device
 * kind, or a single device. A rollout never targets "all tenants": creation
 * requires exactly one scope bound, and each wave applies at most waveSize
 * devices. Reads: any platform user. Writes: platform_super_admin or
 * platform_ops, per the B6 CRUD matrix.
 */

export const listFirmwareRollouts = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    if (args.status !== undefined && !isFirmwareRolloutStatus(args.status)) {
      throw new Error("Unknown rollout status filter");
    }

    let rollouts = await ctx.db.query("firmwareRollouts").collect();
    if (args.status !== undefined) {
      rollouts = rollouts.filter((r) => r.status === args.status);
    }
    rollouts.sort((a, b) => b.createdAt - a.createdAt);

    return Promise.all(
      rollouts.map(async (rollout) => {
        const targetCount = await countScopeDevices(ctx, resolveScope(rollout));
        return buildFirmwareRolloutRow({
          _id: rollout._id,
          label: rollout.label,
          marketId: rollout.marketId ?? null,
          deviceKind: rollout.deviceKind ?? null,
          deviceId: rollout.deviceId ?? null,
          waveSize: rollout.waveSize,
          status: rollout.status as FirmwareRolloutStatus,
          appliedCount: rollout.appliedDeviceIds.length,
          targetCount,
          createdBy: rollout.createdBy ?? null,
          createdAt: rollout.createdAt,
          updatedAt: rollout.updatedAt,
          startedAt: rollout.startedAt ?? null,
          completedAt: rollout.completedAt ?? null,
          cancelledAt: rollout.cancelledAt ?? null,
        });
      }),
    );
  },
});

export const getFirmwareRollout = query({
  args: { rolloutId: v.id("firmwareRollouts") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const rollout = await ctx.db.get(args.rolloutId);
    if (!rollout) return null;

    const scope = resolveScope(rollout);
    const devices = await ctx.db.query("devices").collect();
    const inScope = devices.filter((d) => firmwareRolloutMatchesDevice(scope, d));
    const applied = new Set(rollout.appliedDeviceIds);

    return {
      ...buildFirmwareRolloutRow({
        _id: rollout._id,
        label: rollout.label,
        marketId: rollout.marketId ?? null,
        deviceKind: rollout.deviceKind ?? null,
        deviceId: rollout.deviceId ?? null,
        waveSize: rollout.waveSize,
        status: rollout.status as FirmwareRolloutStatus,
        appliedCount: rollout.appliedDeviceIds.length,
        targetCount: inScope.length,
        createdBy: rollout.createdBy ?? null,
        createdAt: rollout.createdAt,
        updatedAt: rollout.updatedAt,
        startedAt: rollout.startedAt ?? null,
        completedAt: rollout.completedAt ?? null,
        cancelledAt: rollout.cancelledAt ?? null,
      }),
      devices: inScope.map((device) => ({
        _id: device._id,
        name: device.name,
        marketId: device.marketId,
        deviceKind: device.deviceKind,
        firmwareVersion: device.firmwareVersion ?? null,
        applied: applied.has(device._id),
      })),
    };
  },
});

/** Create a draft rollout. The scope must be exactly one of market/kind/device. */
export const createFirmwareRollout = mutation({
  args: {
    label: v.string(),
    marketId: v.optional(v.id("markets")),
    deviceKind: v.optional(v.string()),
    deviceId: v.optional(v.id("devices")),
    waveSize: v.number(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    if (!isValidFirmwareLabel(args.label)) {
      throw new Error("Firmware label must be 3-80 characters");
    }
    const scope = resolveRolloutScope({
      marketId: args.marketId,
      deviceKind: args.deviceKind,
      deviceId: args.deviceId,
    });
    if (!scope) {
      throw new Error(
        "A rollout must target exactly one bound: market, device kind, or single device — never all tenants.",
      );
    }
    if (args.waveSize < 1 || args.waveSize > 500) {
      throw new Error("waveSize must be between 1 and 500 devices per wave");
    }

    const now = Date.now();
    const rolloutId = await ctx.db.insert("firmwareRollouts", {
      label: args.label.trim(),
      marketId: args.marketId,
      deviceKind: args.deviceKind,
      deviceId: args.deviceId,
      waveSize: Math.floor(args.waveSize),
      status: "draft",
      appliedDeviceIds: [],
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "firmwareRollout.create",
      entityTable: "firmwareRollouts",
      entityId: rolloutId,
      changedBy: user._id,
      after: {
        label: args.label,
        marketId: args.marketId,
        deviceKind: args.deviceKind,
        deviceId: args.deviceId,
        waveSize: args.waveSize,
      },
    });

    return rolloutId;
  },
});

/** Start a draft rollout (draft → running). */
export const startFirmwareRollout = mutation({
  args: { rolloutId: v.id("firmwareRollouts") },
  handler: async (ctx, args) => {
    await lifecycleTransition(ctx, args.rolloutId, "start", "firmwareRollout.start");
  },
});

/** Advance the next wave: apply the label to up to waveSize in-scope devices. */
export const advanceFirmwareRolloutWave = mutation({
  args: { rolloutId: v.id("firmwareRollouts") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);
    const rollout = await ctx.db.get(args.rolloutId);
    if (!rollout) throw new Error("Rollout not found");
    if (rollout.status !== "running") {
      throw new Error("Only a running rollout can advance a wave");
    }

    const scope = resolveScope(rollout);
    const devices = await ctx.db.query("devices").collect();
    const inScope = devices.filter((d) => firmwareRolloutMatchesDevice(scope, d));
    const wave = devicesForNextWave(
      inScope.sort(
        (a, b) => (a.createdAt - b.createdAt) || String(a._id).localeCompare(String(b._id)),
      ),
      rollout.appliedDeviceIds,
      rollout.waveSize,
    );
    if (wave.length === 0) {
      throw new Error("All devices in scope are already applied");
    }

    const now = Date.now();
    const appliedDeviceIds = [...rollout.appliedDeviceIds];
    for (const device of wave) {
      if (device.firmwareVersion === rollout.label) {
        // Already at the target label; record it rather than re-patching.
        appliedDeviceIds.push(device._id);
        continue;
      }
      await ctx.db.patch(device._id, {
        firmwareVersion: rollout.label,
        updatedAt: now,
      });
      appliedDeviceIds.push(device._id);
    }

    await ctx.db.patch(args.rolloutId, {
      appliedDeviceIds,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "firmwareRollout.advance",
      entityTable: "firmwareRollouts",
      entityId: args.rolloutId,
      changedBy: user._id,
      after: {
        label: rollout.label,
        appliedCount: appliedDeviceIds.length,
      },
    });
  },
});

/** Pause a running rollout (running → paused). */
export const pauseFirmwareRollout = mutation({
  args: { rolloutId: v.id("firmwareRollouts") },
  handler: async (ctx, args) => {
    await lifecycleTransition(ctx, args.rolloutId, "pause", "firmwareRollout.pause");
  },
});

/** Resume a paused rollout (paused → running). */
export const resumeFirmwareRollout = mutation({
  args: { rolloutId: v.id("firmwareRollouts") },
  handler: async (ctx, args) => {
    await lifecycleTransition(ctx, args.rolloutId, "resume", "firmwareRollout.resume");
  },
});

/** Complete a running rollout (running → completed; all devices applied). */
export const completeFirmwareRollout = mutation({
  args: { rolloutId: v.id("firmwareRollouts") },
  handler: async (ctx, args) => {
    await lifecycleTransition(ctx, args.rolloutId, "complete", "firmwareRollout.complete");
  },
});

/** Cancel a live rollout (draft/running/paused → cancelled). */
export const cancelFirmwareRollout = mutation({
  args: { rolloutId: v.id("firmwareRollouts") },
  handler: async (ctx, args) => {
    await lifecycleTransition(ctx, args.rolloutId, "cancel", "firmwareRollout.cancel");
  },
});

async function lifecycleTransition(
  ctx: MutationCtx,
  rolloutId: Id<"firmwareRollouts">,
  transition: "start" | "pause" | "resume" | "complete" | "cancel",
  action: string,
) {
  const user = await requirePlatformSubRole(ctx, [
    "platform_super_admin",
    "platform_ops",
  ]);
  const rollout = await ctx.db.get(rolloutId);
  if (!rollout) throw new Error("Rollout not found");

  const next = nextRolloutStatus(rollout.status as FirmwareRolloutStatus, transition);
  if (!next || next === (rollout.status as FirmwareRolloutStatus)) {
    throw new Error(`Cannot ${transition} a ${rollout.status} rollout`);
  }

  const now = Date.now();
  const patch: Record<string, unknown> = { status: next, updatedAt: now };
  if (next === "running" && transition === "start") patch.startedAt = now;
  if (next === "completed") patch.completedAt = now;
  if (next === "cancelled") patch.cancelledAt = now;

  await ctx.db.patch(rolloutId, patch);

  await logAudit(ctx, {
    action,
    entityTable: "firmwareRollouts",
    entityId: rolloutId,
    changedBy: user._id,
    after: { status: next },
  });
}

function resolveScope(rollout: {
  _id: string;
  marketId?: string | null;
  deviceKind?: string | null;
  deviceId?: string | null;
}): FirmwareRolloutScope {
  return (
    resolveRolloutScope({
      marketId: rollout.marketId,
      deviceKind: rollout.deviceKind,
      deviceId: rollout.deviceId,
    }) ?? { type: "single", deviceId: String(rollout._id ?? "") }
  );
}

async function countScopeDevices(
  ctx: QueryCtx,
  scope: FirmwareRolloutScope,
): Promise<number> {
  const devices = await ctx.db.query("devices").collect();
  return devices.filter((d) => firmwareRolloutMatchesDevice(scope, d)).length;
}