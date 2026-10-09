import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type ReconciliationRun = {
  _id: string;
  gateway: string;
  statementName: string;
  status: "imported" | "reviewed" | "closed" | "void";
  voidReason?: string;
  rowCount: number;
  matchedCount: number;
  exceptionCount: number;
  importedAt: number;
};
export type StatementImportRow = { rowNumber: number; reference: string; amount: string; currency: string; settledAt: string };
export type ReconciliationRow = {
  _id: string;
  rowNumber: number;
  reference: string;
  statementAmountMinor: number;
  statementCurrency: string;
  settledAt: number;
  matchStatus: "matched" | "missing_payment" | "duplicate_statement" | "ambiguous_payment" | "payment_status_mismatch" | "amount_mismatch" | "currency_mismatch";
  internalAmountMinor?: number;
  internalCurrency?: string;
  internalPaymentStatus?: string;
  tenantName: string | null;
};
export const platformReconciliation = {
  listRuns: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null } }, PaginationResult<ReconciliationRun>>("platformReconciliation:listRuns"),
  listRows: makeFunctionReference<"query", { runId: string; paginationOpts: { numItems: number; cursor: string | null } }, PaginationResult<ReconciliationRow>>("platformReconciliation:listRows"),
  importStatement: makeFunctionReference<"mutation", { gateway: string; statementName: string; rows: StatementImportRow[] }, { runId: string; rowCount: number; matchedCount: number; exceptionCount: number }>("platformReconciliation:importStatement"),
  updateRunStatus: makeFunctionReference<"mutation", { runId: string; status: ReconciliationRun["status"]; reason?: string }, { status: ReconciliationRun["status"] }>("platformReconciliation:updateRunStatus"),
};
