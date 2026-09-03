import { query } from "./_generated/server";
import { requireAuthenticatedUser } from "./lib/auth";

// Debug query to check cron job status
export const getCronStatus = query({
  args: {},
  handler: async (ctx) => {
    await requireAuthenticatedUser(ctx);
    const healthSamples = await ctx.db.query("healthSamples").collect();
    const usageSamples = await ctx.db.query("usageSamples").collect();
    const routers = await ctx.db.query("routers").collect();

    const latestHealthSample = healthSamples.length > 0
      ? healthSamples.reduce((latest, sample) =>
          sample.timestamp > latest.timestamp ? sample : latest
        )
      : null;

    return {
      healthSampleCount: healthSamples.length,
      usageSampleCount: usageSamples.length,
      routerCount: routers.length,
      latestHealthSample: latestHealthSample ? {
        timestamp: latestHealthSample.timestamp,
        timeAgo: Date.now() - latestHealthSample.timestamp,
        cpuPercent: latestHealthSample.cpuPercent,
      } : null,
    };
  },
});
