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

export type StatementImportRow = { rowNumber: number; reference: string; amount: string; currency: string; settledAt: string };
export const MAX_STATEMENT_CSV_BYTES = 1_000_000;

export function parseStatementCsv(source: string): StatementImportRow[] {
  if (new TextEncoder().encode(source).byteLength > MAX_STATEMENT_CSV_BYTES) throw new Error("Statement data must be no larger than 1 MB");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  let quoteClosed = false;
  for (let index = 0; index < source.length; index++) {
    const character = source[index]!;
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') { field += '"'; index++; }
      else if (character === '"') { quoted = false; quoteClosed = true; }
      else field += character;
    } else if (quoteClosed && character !== "," && character !== "\n" && character !== "\r") {
      throw new Error("CSV contains characters after a quoted field");
    } else if (character === '"' && field.length === 0) quoted = true;
    else if (character === '"') throw new Error("CSV contains an invalid quote in an unquoted field");
    else if (character === ",") { row.push(field.trim()); field = ""; quoteClosed = false; }
    else if (character === "\n" || character === "\r") {
      if (character === "\r" && source[index + 1] === "\n") index++;
      row.push(field.trim()); field = "";
      if (row.some((value) => value !== "")) rows.push(row);
      row = []; quoteClosed = false;
      if (rows.length > 501) throw new Error("Import is limited to 500 statement rows");
    } else field += character;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  row.push(field.trim());
  if (row.some((value) => value !== "")) rows.push(row);
  if (rows.length < 2) throw new Error("Add a header row and at least one statement row");
  if (rows.length > 501) throw new Error("Import is limited to 500 statement rows");

  const headers = rows[0]!.map((value, index) => (index === 0 ? value.replace(/^\uFEFF/, "") : value).toLowerCase());
  const required = ["reference", "amount", "currency", "settled_at"];
  const indexes = required.map((name) => headers.indexOf(name));
  if (indexes.some((index) => index < 0) || new Set(indexes).size !== required.length) {
    throw new Error("CSV headers must include reference, amount, currency, settled_at exactly once");
  }
  return rows.slice(1).map((values, index) => {
    const fields = indexes.map((fieldIndex) => values[fieldIndex] ?? "");
    if (fields.some((value) => value === "")) throw new Error(`Statement row ${index + 2} is missing a required value`);
    if (values.slice(headers.length).some((value) => value !== "")) throw new Error(`Statement row ${index + 2} has more values than the header`);
    return { rowNumber: index + 2, reference: fields[0]!, amount: fields[1]!, currency: fields[2]!, settledAt: fields[3]! };
  });
}
