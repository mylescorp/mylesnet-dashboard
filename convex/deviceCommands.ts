import { v } from "convex/values";
import { internalMutation, internalQuery, mutation, query, type MutationCtx } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { getHealthguardEnabled } from "./systemSettings";
import { nextCommandStatus } from "./lib/deviceCommandCore";

/**
 * Operator command queue executed by a router's local collector.
 *
 * Lifecycle: pending -> acknowledged -> completed | failed. Superseded is
 * terminal and only set when a newer restart_collector command supersedes
 * older active commands. A command that expires before the collector touches
 * it is auto-failed by the sweep summary.
 *
 * The collector never acts on a command it has not seen durably acknowledged
 * first (ack is recorded server-side in the same ingest that returns the
 * go-ahead).
 */

export type DeviceCommandType = "reenable_www_ssl" | "restart_collector" | "run_full_healthcheck";

const commandTypes = v.union(
  v.literal("reenable_www_ssl"),
  v.literal("restart_collector"),
  v.literal("run_full_healthcheck"),
);

const deviceCommandTtlMs = () => {
  const parsed = Number(process.env.MYLESNET_DEVICE_COMMAND_TTL_MS ?? 5 * 60 * 1000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 5 * 60 * 1000;
};

const rateWindowMs = () => {
  const parsed = Number(process.env.MYLESNET_DEVICE_COMMAND_RATE_WINDOW_MS ?? 60 * 60 * 1000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 1000;
};

const rateLimit = () => {
  const parsed = Number(process.env.MYLESNET_DEVICE_COMMAND_RATE_LIMIT ?? 5);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5;
};

const healthguardStaleMs = () => {
  const parsed = Number(process.env.MYLESNET_HEALTHGUARD_STALE_MS ?? 10 * 60 * 1000);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 10 * 60 * 1000;
};

const staleAlertCooldownMs = () => {
  const parsed = Number(process.env.MYLESNET_HEALTHGUARD_STALE_ALERT_MIN_MS ?? 60) * 60 * 1000;
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60 * 1000;
};

/** Queues a command for a single router (dedupes; supersedes on restart). */
export const queueCommand = mutation({
  args: {
    routerId: v.id("routers"),
    type: commandTypes,
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "routers:manage");
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found.");
    const now = Date.now();
    const ttl = deviceCommandTtlMs();

    // Dedupe: at most one active command of the same type per router. A second
    // click returns the same queued command instead of stacking rows.
    const activeByType = await ctx.db
      .query("device_commands")
      .withIndex("by_router_type_status", (q) =>
        q.eq("routerId", args.routerId).eq("type", args.type),
      )
      .filter((q) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "acknowledged")),
      )
      .collect();
    const existingActive = activeByType.find((command) => command.expiresAt > now);
    if (existingActive) {
      return { commandId: existingActive._id, status: existingActive.status, queued: false };
    }

    // Rate limit: bounded queuing per router per window.
    const recent = await ctx.db
      .query("device_commands")
      .withIndex("by_router_status", (q) => q.eq("routerId", args.routerId))
      .filter((q) => q.gte(q.field("requestedAt"), now - rateWindowMs()))
      .collect();
    if (recent.length >= rateLimit()) {
      throw new Error("Rate limit: too many commands were queued for this router in the last hour.");
    }

    const commandId = await ctx.db.insert("device_commands", {
      routerId: args.routerId,
      type: args.type,
      status: "pending",
      requestedBy: user._id,
      requestedAt: now,
      attempts: 1,
      expiresAt: now + ttl,
    });

    // A fresh restart supersedes everything else active so a collector that is
    // about to restart cannot drag a stale command across the boundary.
    if (args.type === "restart_collector") {
      const superseded = await ctx.db
        .query("device_commands")
        .withIndex("by_router_status", (q) =>
          q.eq("routerId", args.routerId),
        )
        .filter((q) =>
          q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "acknowledged")),
        )
        .collect();
      for (const command of superseded) {
        if (command._id === commandId) continue;
        await ctx.db.patch(command._id, {
          status: "superseded",
          supersededAt: now,
          supersededByCommandId: commandId,
        });
      }
    }

    await logAudit(ctx, {
      action: "deviceCommand.queue",
      entityTable: "device_commands",
      entityId: commandId,
      changedBy: user._id,
      after: { routerId: args.routerId, type: args.type, expiresAt: now + ttl },
    });

    return { commandId, status: "pending", queued: true };
  },
});

/** Active (pending or acknowledged) commands for a router, oldest first. */
export const listActiveCommands = internalQuery({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const now = Date.now();
    const active = await ctx.db
      .query("device_commands")
      .withIndex("by_router_status", (q) => q.eq("routerId", args.routerId))
      .filter((q) =>
        q.or(q.eq(q.field("status"), "pending"), q.eq(q.field("status"), "acknowledged")),
      )
      .collect();
    return active
      .filter((command) => command.expiresAt > now)
      .sort((left, right) => left.requestedAt - right.requestedAt)
      .map((command) => ({
        commandId: command._id,
        type: command.type,
        status: command.status,
        requestedAt: command.requestedAt,
        expiresAt: command.expiresAt,
      }));
  },
});

/**
 * Console panel: global healthguard switch, this router's guard state, and the
 * recent command queue. One query for the HealthGuard panel.
 */
export const getRouterHealthguardOverview = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "telemetry_health:read");
    const state = await ctx.db
      .query("healthguardStates")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .first();
    const recentCommands = await ctx.db
      .query("device_commands")
      .withIndex("by_router_status", (q) => q.eq("routerId", args.routerId))
      .collect();
    const now = Date.now();
    const commandView = recentCommands
      .slice()
      .sort((left, right) => right.requestedAt - left.requestedAt)
      .slice(0, 8)
      .map((command) => ({
        commandId: command._id,
        type: command.type,
        status: command.status,
        requestedAt: command.requestedAt,
        expiresAt: command.expiresAt,
        errorMessage: command.errorMessage,
      }));
    const reenableCount24h = (state?.reenableTimestamps24h ?? []).length;
    return {
      healthguardEnabled: await getHealthguardEnabled(ctx),
      state: state
        ? {
            lastRunAt: state.lastRunAt,
            wwwSslEnabled: state.wwwSslEnabled,
            lastAction: state.lastAction ?? "none",
            lastActionAt: state.lastActionAt,
            lastActionMessage: state.lastActionMessage,
            reenableCount24h,
            stale: state.lastRunAt !== undefined && now - state.lastRunAt > healthguardStaleMs(),
          }
        : null,
      commands: commandView,
    };
  },
});

/** Applies a collector command report transition (idempotent, per-router). */
export async function applyCommandReport(
  ctx: { db: MutationCtx["db"] },
  report: {
    commandId: Id<"device_commands">;
    routerId: Id<"routers">;
    transition: "acknowledged" | "completed" | "failed";
    observedAt: number;
    errorMessage?: string;
  },
): Promise<void> {
  const command = await ctx.db.get(report.commandId);
  if (!command || command.routerId !== report.routerId) return;
  const next = nextCommandStatus(command.status, report.transition);
  if (next === null) return;
  const patch: { status: "acknowledged" | "completed" | "failed"; acknowledgedAt?: number; completedAt?: number; failedAt?: number; errorMessage?: string } = {
    status: next,
  };
  if (next === "acknowledged") patch.acknowledgedAt = report.observedAt;
  if (next === "completed") patch.completedAt = report.observedAt;
  if (next === "failed") {
    patch.failedAt = report.observedAt;
    patch.errorMessage = report.errorMessage;
  }
  await ctx.db.patch(command._id, patch);
}

/**
 * Five-minute sweep: TTL-fail stale commands and raise `healthguard_stale`
 * alerts for routers whose guard stopped reporting.
 */
export const sweepExpiredCommands = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    for (const status of ["pending", "acknowledged"] as const) {
      const expired = await ctx.db
        .query("device_commands")
        .withIndex("by_status_expiresAt", (q) => q.eq("status", status).lt("expiresAt", now))
        .collect();
      for (const command of expired) {
        await ctx.db.patch(command._id, {
          status: "failed",
          failedAt: now,
          errorMessage: "The command expired before the collector executed it.",
        });
      }
    }

    const states = await ctx.db.query("healthguardStates").collect();
    for (const state of states) {
      if (state.lastRunAt === undefined || now - state.lastRunAt < healthguardStaleMs()) continue;
      const router = await ctx.db.get(state.routerId);
      if (!router || router.archivedAt !== undefined) continue;
      if (state.staleAlertedAt !== undefined && now - state.staleAlertedAt < staleAlertCooldownMs()) continue;
      await ctx.db.patch(state._id, { staleAlertedAt: now });
      await ctx.db.insert("systemEvents", {
        routerId: state.routerId,
        type: "healthguard_stale",
        severity: "warning",
        title: "Healthguard stopped reporting.",
        details: `Last run ${Math.round((now - state.lastRunAt) / 60000)} min ago. The collector may be down or on an older version.`,
        occurredAt: now,
      });
    }
  },
});