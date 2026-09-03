import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";

// Get health samples for trend analysis
export const getHealthTrends = query({
  args: {
    routerId: v.id("routers"),
    hours: v.number(), // Number of hours to look back
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const startTime = Date.now() - args.hours * 60 * 60 * 1000;

    const samples = await ctx.db
      .query("healthSamples")
      .filter((q) => q.eq(q.field("routerId"), args.routerId))
      .filter((q) => q.gte(q.field("timestamp"), startTime))
      .collect();

    // Group by hour for trend data
    const byHour = new Map<number, {
      avgCpu: number;
      avgMemory: number;
      samples: number;
    }>();

    for (const sample of samples) {
      const hour = Math.floor(sample.timestamp / (60 * 60 * 1000));
      const existing = byHour.get(hour) || { avgCpu: 0, avgMemory: 0, samples: 0 };
      existing.avgCpu += sample.cpuPercent;
      existing.avgMemory += sample.memoryPercent;
      existing.samples += 1;
      byHour.set(hour, existing);
    }

    // Calculate averages
    const trends = Array.from(byHour.entries())
      .map(([hour, data]) => ({
        timestamp: hour * 60 * 60 * 1000,
        avgCpu: data.avgCpu / data.samples,
        avgMemory: data.avgMemory / data.samples,
        samples: data.samples,
      }))
      .sort((a, b) => a.timestamp - b.timestamp);

    return trends;
  },
});

// Get latest health sample for a router
export const getLatestHealth = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const samples = await ctx.db
      .query("healthSamples")
      .filter((q) => q.eq(q.field("routerId"), args.routerId))
      .order("desc")
      .first();

    return samples;
  },
});

// Get latest health samples for all access points of a router
export const getAccessPointHealth = query({
  args: { routerId: v.id("routers") },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const accessPoints = await ctx.db
      .query("accessPoints")
      .withIndex("by_router", (q) => q.eq("routerId", args.routerId))
      .collect();

    const healthByAp = await Promise.all(accessPoints.map(async (ap) => {
      const latest = await ctx.db
        .query("healthSamples")
        .filter((q) => q.eq(q.field("routerId"), args.routerId))
        .filter((q) => q.eq(q.field("accessPointId"), ap._id))
        .order("desc")
        .first();

      return latest ? { ...latest, accessPoint: ap } : null;
    }));

    return healthByAp.flatMap((item) => item ? [item] : []);
  },
});

// Get usage report for a specific period
export const getUsageReport = query({
  args: {
    routerId: v.optional(v.id("routers")),
    period: v.string(), // "day", "week", "month"
  },
  handler: async (ctx, args) => {
    await requireAuthenticatedUser(ctx);
    const now = Date.now();
    let startTime: number;

    if (args.period === "day") {
      startTime = now - 24 * 60 * 60 * 1000;
    } else if (args.period === "week") {
      startTime = now - 7 * 24 * 60 * 60 * 1000;
    } else if (args.period === "month") {
      startTime = now - 30 * 24 * 60 * 60 * 1000;
    } else {
      throw new Error("Invalid period");
    }

    const allSamples = await ctx.db.query("usageSamples").collect();
    let samples = allSamples.filter((s) => s.timestamp >= startTime);

    if (args.routerId) {
      samples = samples.filter((s) => s.routerId === args.routerId);
    }

    // Aggregate by subscriber
    const bySubscriber = new Map<string, { totalBytes: number; count: number }>();
    let totalBytes = 0;

    for (const sample of samples) {
      const key = sample.subscriberIdentifier;
      const existing = bySubscriber.get(key) || { totalBytes: 0, count: 0 };
      existing.totalBytes += sample.byteDelta;
      existing.count += 1;
      bySubscriber.set(key, existing);
      totalBytes += sample.byteDelta;
    }

    // Convert to array and sort by usage
    const bySubscriberArray = Array.from(bySubscriber.entries())
      .map(([subscriber, data]) => ({
        subscriber,
        totalBytes: data.totalBytes,
        sampleCount: data.count,
      }))
      .sort((a, b) => b.totalBytes - a.totalBytes);

    return {
      period: args.period,
      startTime,
      endTime: now,
      totalSamples: samples.length,
      totalBytes,
      bySubscriber: bySubscriberArray,
    };
  },
});
