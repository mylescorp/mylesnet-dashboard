import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, mutation, query } from "./_generated/server";
import { requireNetworkOperator } from "./lib/auth";

type ConfigurationBaseline = {
  snapshotJson: string;
  capturedAt: number;
} | null;

export const captureBaseline = action({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args): Promise<{ success: boolean; message: string }> => {
    await ctx.runQuery(internal.platformUsers.assertNetworkOperator, {});
    const snapshot = await ctx.runQuery(
      internal.routers.getLatestRouterConfigurationSnapshot,
      args,
    );
    if (!snapshot) {
      return {
        success: false,
        message: "A current collector configuration snapshot is needed before a baseline can be captured.",
      };
    }
    await ctx.runMutation(internal.routers.saveConfigurationBaseline, {
      routerId: args.routerId,
      snapshotJson: snapshot.snapshotJson,
    });
    return { success: true, message: "Configuration baseline captured successfully." };
  },
});

export const getBaselines = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.platformUsers.assertNetworkOperator, {});
    return ctx.db
      .query("configWatchBaselines")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .collect();
  },
});

export const getLatestBaseline = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await ctx.runQuery(internal.platformUsers.assertNetworkOperator, {});
    return ctx.db
      .query("configWatchBaselines")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .order("desc")
      .first();
  },
});

export const checkConfigDrift = action({
  args: { routerId: v.id("routers") },
  handler: async (
    ctx,
    args,
  ): Promise<{
    success: boolean;
    hasDrift: boolean;
    message: string;
    differences: string[];
    baselineCapturedAt: number | null;
  }> => {
    await ctx.runQuery(internal.platformUsers.assertNetworkOperator, {});
    const baseline: ConfigurationBaseline = await ctx.runQuery(
      internal.routers.getLatestConfigurationBaseline,
      args,
    );
    if (!baseline) {
      return {
        success: false,
        hasDrift: false,
        message: "Capture a configuration baseline before checking for monitored changes.",
        differences: [],
        baselineCapturedAt: null,
      };
    }

    const snapshot = await ctx.runQuery(
      internal.routers.getLatestRouterConfigurationSnapshot,
      args,
    );
    if (!snapshot) {
      return {
        success: false,
        hasDrift: false,
        message: "A current collector configuration snapshot is needed before changes can be checked.",
        differences: [],
        baselineCapturedAt: baseline.capturedAt,
      };
    }
    const hasDrift = snapshot.snapshotJson !== baseline.snapshotJson;

    return {
      success: true,
      hasDrift,
      message: hasDrift
        ? "A monitored configuration change was detected."
        : "No monitored configuration changes were detected.",
      differences: hasDrift ? ["Router configuration differs from the saved baseline."] : [],
      baselineCapturedAt: baseline.capturedAt,
    };
  },
});

export const deleteBaseline = mutation({
  args: { baselineId: v.id("configWatchBaselines") },
  handler: async (ctx, args) => {
    await requireNetworkOperator(ctx);
    await ctx.db.delete(args.baselineId);
  },
});
