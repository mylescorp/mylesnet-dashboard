import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import {
  assessRedemptions,
  type RedemptionRecord,
} from "./lib/voucherFraudCore";

/**
 * Voucher redemption monitor (spec F1).
 *
 * Reads: super_admin (RU), ops (RU), finance (R) per the spec matrix.
 * The anomaly signals (duplicate code / velocity / geo) are computed at
 * QUERY TIME from the redemption records themselves — there is deliberately
 * no counter column. The monitor spans all tenants, so a shared device/IP
 * that jumps tenants is still caught.
 *
 * flagVoucher (write): super_admin + ops; records the disposition
 * (clean/flagged/blocked) plus reason on the voucher itself.
 */
export const listRedemptionMonitor = query({
  args: { marketId: v.optional(v.id("markets")), limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
      "platform_finance",
    ]);

    const cap = Math.min(Math.max(args.limit ?? 50, 1), 100);
    let redeemed = await ctx.db
      .query("vouchers")
      .withIndex("by_status", (q) => q.eq("voucherStatus", "redeemed"))
      .collect();
    if (args.marketId !== undefined) {
      redeemed = redeemed.filter((v) => v.marketId === args.marketId);
    }
    redeemed.sort((a, b) => (b.redeemedAt ?? 0) - (a.redeemedAt ?? 0));
    redeemed = redeemed.slice(0, cap);

    const marketName = new Map<string, string>();
    const marketTenant = new Map<string, string | null>();
    for (const market of await ctx.db.query("markets").collect()) {
      marketName.set(market._id, market.name);
      marketTenant.set(market._id, market.tenantId ?? null);
    }
    const tenantName = new Map<string, string | null>();
    for (const tenant of await ctx.db.query("tenants").collect()) {
      tenantName.set(tenant._id, tenant.name);
    }

    const records: RedemptionRecord[] = redeemed.map((voucher) => ({
      voucherId: voucher._id,
      code: voucher.code,
      marketId: voucher.marketId,
      redeemedAt: voucher.redeemedAt ?? 0,
      customerPhone: voucher.customerPhoneAtRedemption,
      redeemedDeviceId: voucher.redeemedDeviceId,
      redeemedIpAddress: voucher.redeemedIpAddress,
    }));

    const assessed = assessRedemptions(records);

    return redeemed.map((voucher, index) => {
      const resolvedTenantId =
        voucher.tenantId ?? marketTenant.get(voucher.marketId) ?? null;
      const assessment = assessed[index];
      return {
        _id: voucher._id,
        code: voucher.code,
        marketId: voucher.marketId,
        marketName: marketName.get(voucher.marketId) ?? null,
        tenantId: resolvedTenantId,
        tenantName: resolvedTenantId ? (tenantName.get(resolvedTenantId) ?? null) : null,
        redeemedAt: voucher.redeemedAt ?? null,
        customerPhone: voucher.customerPhoneAtRedemption ?? null,
        redeemedDeviceId: voucher.redeemedDeviceId ?? null,
        redeemedIpAddress: voucher.redeemedIpAddress ?? null,
        fraudFlagStatus: voucher.fraudFlagStatus ?? null,
        fraudFlagReason: voucher.fraudFlagReason ?? null,
        signals: assessment.signals,
        suggestedVerdict: assessment.verdict,
        redeemCount: assessment.redeemCount,
        distinctIps: assessment.distinctIps,
      };
    });
  },
});

export const flagVoucher = mutation({
  args: {
    voucherId: v.id("vouchers"),
    fraudFlagStatus: v.union(
      v.literal("clean"),
      v.literal("flagged"),
      v.literal("blocked"),
    ),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    const voucher = await ctx.db.get(args.voucherId);
    if (!voucher) throw new Error("Voucher not found");
    if (voucher.voucherStatus !== "redeemed") {
      throw new Error("Only redeemed vouchers can be flagged");
    }
    if (args.fraudFlagStatus === "flagged" && !args.reason) {
      throw new Error("A flagged voucher requires a reason");
    }
    if (args.reason !== undefined && args.reason.length > 240) {
      throw new Error("Flag reason is too long");
    }

    await ctx.db.patch(args.voucherId, {
      fraudFlagStatus: args.fraudFlagStatus as "clean" | "flagged" | "blocked",
      fraudFlagReason: args.fraudFlagStatus === "clean" ? undefined : args.reason,
    });

    await logAudit(ctx, {
      action: "vouchers.fraud_flag_set",
      entityTable: "vouchers",
      entityId: args.voucherId,
      changedBy: user._id,
      after: {
        fraudFlagStatus: args.fraudFlagStatus,
        reason: args.reason ?? undefined,
      },
    });
  },
});