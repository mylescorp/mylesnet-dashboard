export type BillingAnomalyType = "stale_pending" | "duplicate_reference" | "invoice_status_mismatch" | "negative_amount";
export type BillingAnomalyInput = {
  status: "pending" | "completed" | "failed" | "refunded";
  amount: number;
  paymentDate: number;
  invoiceStatus?: "draft" | "issued" | "paid" | "overdue" | "cancelled";
  hasDuplicateReference: boolean;
};

export function detectBillingAnomalies(input: BillingAnomalyInput, now: number, staleAfterMs = 24 * 60 * 60 * 1000): BillingAnomalyType[] {
  const findings: BillingAnomalyType[] = [];
  if (input.status === "pending" && input.paymentDate <= now - staleAfterMs) findings.push("stale_pending");
  if (input.hasDuplicateReference) findings.push("duplicate_reference");
  if (input.status === "completed" && input.invoiceStatus !== undefined && input.invoiceStatus !== "paid") findings.push("invoice_status_mismatch");
  if (input.amount < 0) findings.push("negative_amount");
  return findings;
}

export function clampAnomalyWindowDays(value: number | undefined): number {
  if (value === undefined || !Number.isFinite(value)) return 30;
  return Math.max(1, Math.min(90, Math.floor(value)));
}
