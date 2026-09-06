import { v } from "convex/values";
import { internalQuery, mutation, query } from "./_generated/server";
import { requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

/**
 * Notification preferences matrix (spec §17 + §32). Each user toggles which
 * categories reach them on which channels. Escalation delay applies to
 * SMS/email notifications whose severity crosses a threshold.
 */

export const alertCategories = [
  "device_online",
  "device_offline",
  "low_ccq",
  "high_tx_power",
  "rogue_device",
  "link_flap",
  "high_cpu",
  "high_memory",
  "packet_loss",
  "bounce_rate",
  "renewal_digest",
  "payout_status",
  "daily_digest",
  "investor_report",
] as const;

export const listMyPreferences = query({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlatformUser(ctx);
    const prefs = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();
    // Return the full matrix with defaults filled in so the UI can render
    // every row even before the user touches it.
    const enabled = new Set(prefs.filter((p) => p.enabled).map((p) => `${p.category}:${p.channel}`));
    return alertCategories.map((category) => ({
      category,
      sms: enabled.has(`${category}:sms`),
      email: enabled.has(`${category}:email`),
      dashboard: enabled.has(`${category}:dashboard`),
      stored: prefs.filter((p) => p.category === category),
    }));
  },
});

export const updatePreference = mutation({
  args: {
    category: v.union(...alertCategories.map((category) => v.literal(category))),
    channel: v.union(v.literal("sms"), v.literal("email"), v.literal("dashboard")),
    enabled: v.boolean(),
    escalationDelayMinutes: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformUser(ctx);
    const existing = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) =>
        q.and(
          q.eq(q.field("category"), args.category),
          q.eq(q.field("channel"), args.channel)
        )
      )
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        enabled: args.enabled,
        escalationDelayMinutes: args.escalationDelayMinutes,
      });
    } else {
      await ctx.db.insert("notificationPreferences", {
        userId: user._id,
        category: args.category,
        channel: args.channel,
        enabled: args.enabled,
        escalationDelayMinutes: args.escalationDelayMinutes,
      });
    }
    await logAudit(ctx, {
      action: "notification_pref.update",
      entityTable: "notificationPreferences",
      entityId: user._id,
      changedBy: user._id,
      after: { category: args.category, channel: args.channel, enabled: args.enabled },
    });
  },
});

/** Whether a user has enabled a category on a channel (defaults ON for dashboard/email, OFF for SMS). */
export const isPreferenceEnabled = internalQuery({
  args: { userId: v.id("users"), category: v.string(), channel: v.union(v.literal("sms"), v.literal("email"), v.literal("dashboard")) },
  handler: async (ctx, args) => {
    const pref = await ctx.db
      .query("notificationPreferences")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .filter((q) =>
        q.and(
          q.eq(q.field("category"), args.category),
          q.eq(q.field("channel"), args.channel)
        )
      )
      .first();
    if (pref) return { enabled: pref.enabled, escalationDelayMinutes: pref.escalationDelayMinutes };
    // Sensible defaults: dashboard always, email for operational categories,
    // SMS only if the user explicitly opts in (SMS costs money per message).
    const dashboardDefault = true;
    const emailDefault =
      args.category !== "daily_digest" && args.category !== "investor_report" && args.category !== "payout_status"
        ? true
        : false;
    const smsDefault = false;
    const enabled = args.channel === "dashboard" ? dashboardDefault : args.channel === "email" ? emailDefault : smsDefault;
    return { enabled, escalationDelayMinutes: undefined };
  },
});