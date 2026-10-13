import { makeFunctionReference } from "convex/server";

export type PlatformHealthOverview = {
  checkedAt: number;
  convex: "reachable";
  workosWebhook: {
    deliveryStatus: "no_recent_data" | "attention" | "observed_ok";
    sampleWindowHours: number;
    recentDeliverySamples: number;
    signatureValidSamples: number;
    processedSamples: number;
    sampledQueueCounts: { received: number; completed: number; retry: number; quarantined: number };
    queueSampleLimitPerStatus: number;
  };
  vercel: "not_monitored";
  uptime: "not_monitored";
};

export const platformHealth = {
  getOverview: makeFunctionReference<"query", { probe: number }, PlatformHealthOverview>("platformHealth:getOverview"),
};
