import { v } from "convex/values";
import { query } from "./_generated/server";

// Get usage report for a specific period
export const getUsageReport = query({
  args: {
    routerId: v.optional(v.id("routers")),
    period: v.string(), // "day", "week", "month"
  },
  handler: async (ctx, args) => {
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
