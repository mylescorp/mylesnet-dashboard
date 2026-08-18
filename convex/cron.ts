import { v } from "convex/values";
import { action, mutation, query } from "./_generated/server";

// Simple cron jobs - will be enabled after RouterOS integration is tested
export const collectHealthData = action({
  args: {},
  handler: async (ctx) => {
    console.log("Health data collection scheduled - waiting for RouterOS integration");
  },
});

export const collectUsageData = action({
  args: {},
  handler: async (ctx) => {
    console.log("Usage data collection scheduled - waiting for RouterOS integration");
  },
});
