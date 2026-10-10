import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type PlatformBillingAnomaly = {
  key: string;
  paymentId: string;
  anomalyType: "stale_pending" | "duplicate_reference" | "invoice_status_mismatch" | "negative_amount";
  status: "open" | "acknowledged" | "resolved";
  note: string | null;
  amount: number;
  currency: string;
  gateway: string;
  reference: string;
  paymentStatus: "pending" | "completed" | "failed" | "refunded";
  paymentDate: number;
  invoiceStatus: "draft" | "issued" | "paid" | "overdue" | "cancelled" | null;
  tenantName: string | null;
  sessionCorrelation: "unavailable";
};
export const platformBillingAnomalies = {
  list: makeFunctionReference<"query", { days?: number; paginationOpts: { numItems: number; cursor: string | null } }, PaginationResult<PlatformBillingAnomaly>>("platformBillingAnomalies:list"),
  review: makeFunctionReference<"mutation", { paymentId: string; anomalyType: PlatformBillingAnomaly["anomalyType"]; status: PlatformBillingAnomaly["status"]; note: string | null }, { status: PlatformBillingAnomaly["status"] }>("platformBillingAnomalies:review"),
};
