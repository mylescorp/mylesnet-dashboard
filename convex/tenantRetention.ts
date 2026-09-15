import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Daily retention-enforcement sweep (A3). No destructive action — purge
 * requires a super-admin to invoke purgeTenant AFTER the window elapsed
 * (assertCanPurge enforces that on the attempt). This job's job is to keep
 * the window honest and gel the report inspectable: which pending-deletion
 * tenants are now purge-eligible vs. still inside their window.
 */
export const enforceTenantRetention = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const pending = await ctx.db
      .query("tenants")
      .withIndex("by_status", (q) => q.eq("status", "pending_deletion"))
      .collect();

    const active = pending.filter((tenant) => tenant.deletedAt === undefined);
    const eligibleForPurge = active
      .filter(
        (tenant) =>
          tenant.purgeEligibleAt !== undefined && tenant.purgeEligibleAt <= now,
      )
      .map((tenant) => ({
        tenantId: tenant._id,
        purgeEligibleAt: tenant.purgeEligibleAt,
      }));

    return {
      checkedAt: now,
      pendingDeletionCount: active.length,
      eligibleForPurge,
      awaitingWindowCount: active.length - eligibleForPurge.length,
    };
  },
});