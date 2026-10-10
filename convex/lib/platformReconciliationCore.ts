export type StatementLine = { rowNumber: number; reference: string; amountMinor: number; currency: string; settledAt: number };
export type PaymentMatchInput = { id: string; tenantId?: string; amount: number; currency: string; status?: string };
export type ReconciliationMatchStatus = "matched" | "missing_payment" | "duplicate_statement" | "ambiguous_payment" | "payment_status_mismatch" | "amount_mismatch" | "currency_mismatch";

export function parseMajorAmountToMinor(value: string): number {
  const normalized = value.trim();
  if (!/^\d{1,12}(?:\.\d{1,2})?$/.test(normalized)) throw new Error("Statement amounts must be non-negative and have at most two decimal places");
  const amount = Number(normalized);
  if (!Number.isSafeInteger(Math.round(amount * 100))) throw new Error("Statement amount is outside the supported range");
  return Math.round(amount * 100);
}

export function parseStatementTimestamp(value: string): number {
  const trimmed = value.trim();
  const numeric = Number(trimmed);
  const timestamp = trimmed !== "" && Number.isFinite(numeric) ? numeric < 1_000_000_000_000 ? numeric * 1000 : numeric : Date.parse(trimmed);
  if (!Number.isFinite(timestamp) || timestamp <= 0) throw new Error("Settlement time must be a valid ISO date or Unix timestamp");
  return Math.floor(timestamp);
}

export function matchStatementLine(line: StatementLine, candidates: PaymentMatchInput[], duplicateInStatement: boolean): { status: ReconciliationMatchStatus; payment?: PaymentMatchInput; internalAmountMinor?: number } {
  if (duplicateInStatement) return { status: "duplicate_statement" };
  if (candidates.length === 0) return { status: "missing_payment" };
  if (candidates.length > 1) return { status: "ambiguous_payment" };
  const payment = candidates[0]!;
  const internalAmountMinor = Math.round(payment.amount * 100);
  if (payment.status !== undefined && payment.status !== "completed") return { status: "payment_status_mismatch", payment, internalAmountMinor };
  if (payment.currency.trim().toUpperCase() !== line.currency.trim().toUpperCase()) return { status: "currency_mismatch", payment, internalAmountMinor };
  if (!Number.isFinite(payment.amount) || Math.abs(payment.amount * 100 - internalAmountMinor) > 0.000001 || internalAmountMinor !== line.amountMinor) return { status: "amount_mismatch", payment, internalAmountMinor };
  return { status: "matched", payment, internalAmountMinor };
}

export type ReconciliationRunStatus = "imported" | "reviewed" | "closed" | "void";
export function canTransitionRunStatus(from: ReconciliationRunStatus, to: ReconciliationRunStatus): boolean {
  if (from === "void") return false;
  if (to === "void") return true;
  return (from === "imported" && to === "reviewed") || (from === "reviewed" && to === "closed");
}
