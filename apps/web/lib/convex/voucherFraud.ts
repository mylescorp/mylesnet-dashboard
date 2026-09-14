import { makeFunctionReference } from "convex/server";

export type FraudFlagStatus = "clean" | "flagged" | "blocked";
export type RedemptionSignal = "duplicate_code" | "velocity" | "geo_anomaly";
export type AnomalyVerdict = "blocked" | "flagged" | "clean";

export type RedemptionMonitorRow = {
  _id: string;
  code: string;
  marketId: string;
  marketName: string | null;
  tenantId: string | null;
  tenantName: string | null;
  redeemedAt: number | null;
  customerPhone: string | null;
  redeemedDeviceId: string | null;
  redeemedIpAddress: string | null;
  fraudFlagStatus: FraudFlagStatus | null;
  fraudFlagReason: string | null;
  signals: RedemptionSignal[];
  suggestedVerdict: AnomalyVerdict;
  redeemCount: number;
  distinctIps: number;
};

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const voucherFraud = {
  monitor: makeFunctionReference<
    "query",
    { marketId?: string; limit?: number },
    RedemptionMonitorRow[]
  >("voucherFraud:listRedemptionMonitor"),
  flagVoucher: makeFunctionReference<
    "mutation",
    {
      voucherId: string;
      fraudFlagStatus: FraudFlagStatus;
      reason?: string;
    },
    void
  >("voucherFraud:flagVoucher"),
};