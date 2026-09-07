import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Global operator settings served to collectors and read by the console.
 * Conventions: one row per key, values stored as JSON strings, and a missing
 * row means "built-in default" (so the healthguard defaults to enabled).
 */

const HEALTHGUARD_ENABLED_KEY = "healthguardEnabled";

async function readRawSetting(ctx: Pick<QueryCtx, "db">, key: string): Promise<string | undefined> {
  const row = await ctx.db
    .query("system_settings")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();
  return row?.valueJson;
}

export async function getHealthguardEnabled(ctx: Pick<QueryCtx, "db">): Promise<boolean> {
  const value = await readRawSetting(ctx, HEALTHGUARD_ENABLED_KEY);
  return value === undefined ? true : value === "true";
}

/** Internal read used by the collector ingest handler. */
export const getHealthguardEnabledInternal = internalQuery({
  args: {},
  handler: async (ctx) => getHealthguardEnabled(ctx),
});

/** Console read for the HealthGuard panels. */
export const getSystemSettingsView = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "telemetry_health:read");
    return { healthguardEnabled: await getHealthguardEnabled(ctx) };
  },
});

/** Kill switch for collector-side self-healing (defaults to enabled). */
export const setHealthguardEnabled = mutation({
  args: { enabled: v.boolean() },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "collector:manage");
    const now = Date.now();
    const existing = await ctx.db
      .query("system_settings")
      .withIndex("by_key", (q) => q.eq("key", HEALTHGUARD_ENABLED_KEY))
      .first();
    const before = await getHealthguardEnabled(ctx);
    const valueJson = String(args.enabled);
    if (existing) {
      await ctx.db.patch(existing._id, { valueJson, updatedAt: now, updatedBy: user._id });
    } else {
      await ctx.db.insert("system_settings", {
        key: HEALTHGUARD_ENABLED_KEY,
        valueJson,
        updatedAt: now,
        updatedBy: user._id,
      });
    }
    await logAudit(ctx, {
      action: "settings.healthguardEnabled",
      entityTable: "system_settings",
      entityId: existing?._id ?? HEALTHGUARD_ENABLED_KEY,
      changedBy: user._id,
      before: { enabled: before },
      after: { enabled: args.enabled },
    });
  },
});