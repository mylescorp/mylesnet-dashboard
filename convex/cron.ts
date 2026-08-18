import { v } from "convex/values";
import { action } from "./_generated/server";

// Cron jobs temporarily disabled - need proper Convex action pattern refactoring
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
