import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";

function thresholdPair(warning: number, critical: number, label: string) {
  if (
    !Number.isFinite(warning) ||
    !Number.isFinite(critical) ||
    warning < 1 ||
    critical > 100 ||
    warning >= critical
  ) {
    throw new Error(`${label} warning must be lower than critical, within 1-100`);
  }
  return { warning, critical };
}

// Update CPU + memory alert thresholds for a router
export const updateRouterMonitorThresholds = mutation({
  args: {
    routerId: v.id("routers"),
    cpuWarningThreshold: v.optional(v.number()),
    cpuCriticalThreshold: v.optional(v.number()),
    memoryWarningThreshold: v.optional(v.number()),
    memoryCriticalThreshold: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const router = await ctx.db.get(args.routerId);
    if (!router || router.archivedAt !== undefined) throw new Error("Router not found");
    const cpu = thresholdPair(
      args.cpuWarningThreshold ?? router.cpuWarningThreshold ?? 75,
      args.cpuCriticalThreshold ?? router.cpuCriticalThreshold ?? 90,
      "CPU",
    );
    const memory = thresholdPair(
      args.memoryWarningThreshold ?? router.memoryWarningThreshold ?? 80,
      args.memoryCriticalThreshold ?? router.memoryCriticalThreshold ?? 90,
      "Memory",
    );
    await ctx.db.patch(args.routerId, {
      cpuWarningThreshold: cpu.warning,
      cpuCriticalThreshold: cpu.critical,
      memoryWarningThreshold: memory.warning,
      memoryCriticalThreshold: memory.critical,
      updatedAt: Date.now(),
    });
  },
});

// Get CPU + memory alert thresholds for a router
export const getRouterMonitorThresholds = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const router = await ctx.db.get(args.routerId);
    if (!router) return null;
    return {
      cpuWarningThreshold: router.cpuWarningThreshold ?? 75,
      cpuCriticalThreshold: router.cpuCriticalThreshold ?? 90,
      memoryWarningThreshold: router.memoryWarningThreshold ?? 80,
      memoryCriticalThreshold: router.memoryCriticalThreshold ?? 90,
    };
  },
});

// Update CPU thresholds for a router (legacy single-purpose helper)
export const updateCpuThresholds = mutation({
  args: {
    routerId: v.id("routers"),
    cpuWarningThreshold: v.number(),
    cpuCriticalThreshold: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    await ctx.db.patch(args.routerId, {
      cpuWarningThreshold: args.cpuWarningThreshold,
      cpuCriticalThreshold: args.cpuCriticalThreshold,
      updatedAt: Date.now(),
    });
  },
});

// Get CPU thresholds for a router (legacy single-purpose helper)
export const getCpuThresholds = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const router = await ctx.db.get(args.routerId);
    if (!router) return null;

    return {
      cpuWarningThreshold: router.cpuWarningThreshold || 75,
      cpuCriticalThreshold: router.cpuCriticalThreshold || 90,
    };
  },
});