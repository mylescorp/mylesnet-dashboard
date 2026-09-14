import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { rolloutPercentOf, isFlagEnabledForTenant } from "./lib/featureFlagCore";

const FLAG_KEY_PATTERN = /^[a-z][a-z0-9]*(?:\.[a-z][a-z0-9]*)*$/;

/**
 * Platform feature-flag store (spec K).
 *
 * Reads are open to any platform user. Create and delete require
 * platform_super_admin; updating an existing flag additionally admits
 * platform_ops ("ops can flip infra flags").
 *
 * valueJson is a JSON-encoded payload; an integer `rolloutPercent` (0-100)
 * inside it drives percentage rollouts when tenantIds is absent.
 */
export const listFeatureFlags = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    return (await ctx.db.query("featureFlags").collect()).sort((a, b) =>
      a.key.localeCompare(b.key),
    );
  },
});

export const getFeatureFlag = query({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return (
      (await ctx.db
        .query("featureFlags")
        .withIndex("by_key", (q) => q.eq("key", args.key))
        .first()) ?? null
    );
  },
});

/**
 * Effective on/off for one flag against one tenant (percentage rollout and
 * tenant override evaluated server-side). Any platform user may evaluate.
 */
export const evaluateFeatureFlag = query({
  args: { key: v.string(), tenantId: v.optional(v.id("tenants")) },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const flag = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!flag) return null;
    return {
      key: flag.key,
      enabled: flag.enabled,
      rolloutPercent: rolloutPercentOf(flag.valueJson) ?? null,
      tenantOverride: (flag.tenantIds ?? null) as string[] | null,
      effectiveOn: isFlagEnabledForTenant(
        {
          key: flag.key,
          enabled: flag.enabled,
          tenantIds: flag.tenantIds ?? undefined,
          valueJson: flag.valueJson,
        },
        args.tenantId,
      ),
    };
  },
});

export const setFeatureFlag = mutation({
  args: {
    key: v.string(),
    valueJson: v.string(),
    enabled: v.boolean(),
    description: v.optional(v.string()),
    tenantIds: v.optional(v.array(v.id("tenants"))),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    if (!FLAG_KEY_PATTERN.test(args.key)) {
      throw new Error("Flag key must start lowercase and use [a-z0-9] with dots only");
    }
    if (args.key.length > 80) throw new Error("Flag key is too long");
    if (args.description !== undefined && args.description.length > 240) {
      throw new Error("Flag description is too long");
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(args.valueJson);
    } catch {
      throw new Error("valueJson must be valid JSON");
    }
    if (parsed === null || Array.isArray(parsed) || typeof parsed !== "object") {
      throw new Error("valueJson must be a JSON object");
    }
    const percent = rolloutPercentOf(args.valueJson);
    if (percent !== undefined && (args.tenantIds && args.tenantIds.length > 0)) {
      throw new Error("rolloutPercent and tenantIds override cannot be combined");
    }
    if (args.tenantIds !== undefined && args.tenantIds.length > 0) {
      for (const tenantId of args.tenantIds) {
        const tenant = await ctx.db.get(tenantId);
        if (!tenant) throw new Error("tenantIds references an unknown tenant");
      }
    }

    const now = Date.now();
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        valueJson: args.valueJson,
        enabled: args.enabled,
        description: args.description,
        tenantIds: args.tenantIds,
        updatedAt: now,
        updatedBy: user._id,
      });
      await logAudit(ctx, {
        action: "feature_flags.updated",
        entityTable: "featureFlags",
        entityId: existing._id,
        changedBy: user._id,
        before: { enabled: existing.enabled },
        after: { enabled: args.enabled, key: args.key },
      });
      return existing._id;
    }

    const id = await ctx.db.insert("featureFlags", {
      key: args.key,
      valueJson: args.valueJson,
      enabled: args.enabled,
      description: args.description,
      tenantIds: args.tenantIds,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
      updatedBy: user._id,
    });
    await logAudit(ctx, {
      action: "feature_flags.created",
      entityTable: "featureFlags",
      entityId: id,
      changedBy: user._id,
      after: { key: args.key, enabled: args.enabled },
    });
    return id;
  },
});

export const removeFeatureFlag = mutation({
  args: { key: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const existing = await ctx.db
      .query("featureFlags")
      .withIndex("by_key", (q) => q.eq("key", args.key))
      .first();
    if (!existing) throw new Error("Feature flag not found");
    await ctx.db.delete(existing._id);
    await logAudit(ctx, {
      action: "feature_flags.deleted",
      entityTable: "featureFlags",
      entityId: existing._id,
      changedBy: user._id,
      after: { key: existing.key },
    });
  },
});