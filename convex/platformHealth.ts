import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";

const healthReaders = [
  "platform_super_admin",
  "platform_ops",
  "platform_finance",
  "platform_support",
  "platform_readonly",
];
const sampleLimit = 50;

/** Read-only, secret-free health snapshot for the platform control plane. */
export const getOverview = query({
  args: { probe: v.number() },
  handler: async (ctx, _args) => {
    await requirePlatformSubRole(ctx, healthReaders);
    const [received, completed, retry, quarantined, deliveries] = await Promise.all([
      ctx.db.query("workosWebhookEvents").withIndex("by_status", (q) => q.eq("status", "received")).take(sampleLimit),
      ctx.db.query("workosWebhookEvents").withIndex("by_status", (q) => q.eq("status", "completed")).take(sampleLimit),
      ctx.db.query("workosWebhookEvents").withIndex("by_status", (q) => q.eq("status", "retry")).take(sampleLimit),
      ctx.db.query("workosWebhookEvents").withIndex("by_status", (q) => q.eq("status", "quarantined")).take(sampleLimit),
      ctx.db.query("webhookDeliveryLog").withIndex("by_receivedAt").order("desc").take(100),
    ]);
    const dayAgo = Date.now() - 24 * 60 * 60 * 1000;
    const recent = deliveries.filter((delivery) => delivery.receivedAt >= dayAgo);
    const verified = recent.filter((delivery) => delivery.signatureValid);
    const processed = verified.filter((delivery) => delivery.processed);
    const deliveryStatus = recent.length === 0
      ? "no_recent_data" as const
      : recent.some((delivery) => !delivery.signatureValid || !delivery.processed)
        ? "attention" as const
        : "observed_ok" as const;

    return {
      checkedAt: Date.now(),
      convex: "reachable" as const,
      workosWebhook: {
        deliveryStatus,
        sampleWindowHours: 24,
        recentDeliverySamples: recent.length,
        signatureValidSamples: verified.length,
        processedSamples: processed.length,
        sampledQueueCounts: {
          received: received.length,
          completed: completed.length,
          retry: retry.length,
          quarantined: quarantined.length,
        },
        queueSampleLimitPerStatus: sampleLimit,
      },
      vercel: "not_monitored" as const,
      uptime: "not_monitored" as const,
    };
  },
});
