import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Update CPU thresholds for a router
export const updateCpuThresholds = mutation({
  args: {
    routerId: v.id("routers"),
    cpuWarningThreshold: v.number(),
    cpuCriticalThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.routerId, {
      cpuWarningThreshold: args.cpuWarningThreshold,
      cpuCriticalThreshold: args.cpuCriticalThreshold,
      updatedAt: Date.now(),
    });
  },
});

// Get CPU thresholds for a router
export const getCpuThresholds = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    const router = await ctx.db.get(args.routerId);
    if (!router) return null;

    return {
      cpuWarningThreshold: router.cpuWarningThreshold || 75,
      cpuCriticalThreshold: router.cpuCriticalThreshold || 90,
    };
  },
});