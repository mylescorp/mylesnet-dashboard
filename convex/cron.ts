import { v } from "convex/values";
import { action } from "./_generated/server";

// Cron jobs temporarily disabled - need to refactor to use proper Convex action patterns
// These will be re-enabled once RouterOS integration is tested manually
export const collectHealthData = action({
  args: {},
  handler: async (ctx) => {
    console.log("Health data collection - temporarily disabled");
  },
});

export const collectUsageData = action({
  args: {},
  handler: async (ctx) => {
    console.log("Usage data collection - temporarily disabled");
  },
});
