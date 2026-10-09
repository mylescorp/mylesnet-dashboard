import { test } from "node:test";
import assert from "node:assert/strict";
import { canTransitionRunStatus, matchStatementLine, parseMajorAmountToMinor, parseStatementTimestamp } from "./platformReconciliationCore.ts";

const line = { rowNumber: 2, reference: "gw-1", amountMinor: 1250, currency: "KES", settledAt: 1_800_000_000_000 };
test("statement parser accepts exact minor-unit amounts and rejects ambiguous precision", () => {
  assert.equal(parseMajorAmountToMinor("12.50"), 1250);
  assert.equal(parseMajorAmountToMinor("0"), 0);
  assert.throws(() => parseMajorAmountToMinor("12.501"));
  assert.throws(() => parseMajorAmountToMinor("-1"));
});

test("settlement parser accepts ISO and second/millisecond Unix timestamps", () => {
  assert.equal(parseStatementTimestamp("1800000000"), 1_800_000_000_000);
  assert.equal(parseStatementTimestamp("1800000000000"), 1_800_000_000_000);
  assert.equal(parseStatementTimestamp("2027-01-15T08:00:00.000Z"), Date.parse("2027-01-15T08:00:00.000Z"));
  assert.throws(() => parseStatementTimestamp("no date"));
});

test("statement matching classifies duplicates, missing/ambiguous payments, currency, amount, and exact match", () => {
  assert.equal(matchStatementLine(line, [], false).status, "missing_payment");
  assert.equal(matchStatementLine(line, [{ id: "a", amount: 12.5, currency: "KES" }, { id: "b", amount: 12.5, currency: "KES" }], false).status, "ambiguous_payment");
  assert.equal(matchStatementLine(line, [{ id: "a", amount: 12.5, currency: "KES" }], true).status, "duplicate_statement");
  assert.equal(matchStatementLine(line, [{ id: "a", amount: 12.5, currency: "UGX" }], false).status, "currency_mismatch");
  assert.equal(matchStatementLine(line, [{ id: "a", amount: 12.51, currency: "KES" }], false).status, "amount_mismatch");
  assert.equal(matchStatementLine(line, [{ id: "a", amount: 12.5, currency: "KES", status: "pending" }], false).status, "payment_status_mismatch");
  assert.equal(matchStatementLine(line, [{ id: "a", tenantId: "t1", amount: 12.5, currency: "KES" }], false).status, "matched");
});

test("reconciliation runs progress imported to reviewed to closed and can be voided with no hard delete", () => {
  assert.equal(canTransitionRunStatus("imported", "reviewed"), true);
  assert.equal(canTransitionRunStatus("reviewed", "closed"), true);
  assert.equal(canTransitionRunStatus("imported", "closed"), false);
  assert.equal(canTransitionRunStatus("closed", "reviewed"), false);
  assert.equal(canTransitionRunStatus("closed", "void"), true);
  assert.equal(canTransitionRunStatus("void", "reviewed"), false);
});
