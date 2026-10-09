import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Id } from "./_generated/dataModel";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { canTransitionRunStatus, matchStatementLine, parseMajorAmountToMinor, parseStatementTimestamp } from "./lib/platformReconciliationCore";

const managers = ["platform_super_admin", "platform_finance"];
const readers = [...managers, "platform_ops"];
const runStatus = v.union(v.literal("imported"), v.literal("reviewed"), v.literal("closed"), v.literal("void"));
const rowArgs = v.object({ rowNumber: v.number(), reference: v.string(), amount: v.string(), currency: v.string(), settledAt: v.string() });

export const listRuns = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    return ctx.db.query("platformPaymentReconciliationRuns").withIndex("by_importedAt").order("desc").paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(50, args.paginationOpts.numItems)) });
  },
});

export const listRows = query({
  args: { runId: v.id("platformPaymentReconciliationRuns"), paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, readers);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Reconciliation run not found");
    const page = await ctx.db.query("platformPaymentReconciliationRows").withIndex("by_run_and_row", q => q.eq("runId", args.runId)).order("asc").paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(100, args.paginationOpts.numItems)) });
    return { ...page, page: await Promise.all(page.page.map(async row => ({ ...row, tenantName: row.tenantId ? (await ctx.db.get(row.tenantId))?.name ?? null : null }))) };
  },
});

export const importStatement = mutation({
  args: { gateway: v.string(), statementName: v.string(), rows: v.array(rowArgs) },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    const gateway = args.gateway.trim();
    const statementName = args.statementName.trim();
    if (!gateway || gateway.length > 80) throw new Error("Gateway name must be between 1 and 80 characters");
    if (!statementName || statementName.length > 160) throw new Error("Statement name must be between 1 and 160 characters");
    if (args.rows.length < 1 || args.rows.length > 500) throw new Error("Import between 1 and 500 statement rows at a time");
    const seenRows = new Set<number>();
    const parsed = args.rows.map(row => {
      if (!Number.isInteger(row.rowNumber) || row.rowNumber < 2 || seenRows.has(row.rowNumber)) throw new Error("Statement row numbers must be unique integers starting at 2");
      seenRows.add(row.rowNumber);
      const reference = row.reference.trim();
      const currency = row.currency.trim().toUpperCase();
      if (!reference || reference.length > 200) throw new Error(`Row ${row.rowNumber}: reference must be between 1 and 200 characters`);
      if (!/^[A-Z]{3}$/.test(currency)) throw new Error(`Row ${row.rowNumber}: currency must be a three-letter code`);
      return { rowNumber: row.rowNumber, reference, amountMinor: parseMajorAmountToMinor(row.amount), currency, settledAt: parseStatementTimestamp(row.settledAt) };
    });
    const countsByReference = new Map<string, number>();
    for (const row of parsed) countsByReference.set(row.reference, (countsByReference.get(row.reference) ?? 0) + 1);
    const now = Date.now();
    const runId = await ctx.db.insert("platformPaymentReconciliationRuns", { gateway, statementName, status: "imported", rowCount: parsed.length, matchedCount: 0, exceptionCount: parsed.length, importedBy: actor._id, importedAt: now, updatedBy: actor._id, updatedAt: now });
    let matchedCount = 0;
    for (const row of parsed) {
      const candidates = countsByReference.get(row.reference)! > 1 ? [] : await ctx.db.query("payments").withIndex("by_gateway_reference", q => q.eq("gateway", gateway).eq("reference", row.reference)).take(2);
      const match = matchStatementLine(row, candidates.map(payment => ({ id: payment._id, tenantId: payment.tenantId, amount: payment.amount, currency: payment.currency, status: payment.status })), countsByReference.get(row.reference)! > 1);
      if (match.status === "matched") matchedCount++;
      await ctx.db.insert("platformPaymentReconciliationRows", {
        runId,
        rowNumber: row.rowNumber,
        reference: row.reference,
        statementAmountMinor: row.amountMinor,
        statementCurrency: row.currency,
        settledAt: row.settledAt,
        matchStatus: match.status,
        ...(match.payment ? { paymentId: match.payment.id as Id<"payments">, tenantId: match.payment.tenantId as Id<"tenants"> } : {}),
        ...(match.internalAmountMinor === undefined ? {} : { internalAmountMinor: match.internalAmountMinor }),
        ...(match.payment ? { internalCurrency: match.payment.currency, internalPaymentStatus: match.payment.status } : {}),
      });
    }
    const exceptionCount = parsed.length - matchedCount;
    await ctx.db.patch(runId, { matchedCount, exceptionCount, updatedAt: Date.now() });
    await logAudit(ctx, { action: "platform.paymentReconciliation.imported", entityTable: "platformPaymentReconciliationRuns", entityId: runId, changedBy: actor._id, after: { gateway, rowCount: parsed.length, matchedCount, exceptionCount } });
    return { runId, rowCount: parsed.length, matchedCount, exceptionCount };
  },
});

export const updateRunStatus = mutation({
  args: { runId: v.id("platformPaymentReconciliationRuns"), status: runStatus, reason: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, managers);
    const run = await ctx.db.get(args.runId);
    if (!run) throw new Error("Reconciliation run not found");
    if (!canTransitionRunStatus(run.status, args.status)) throw new Error(`Cannot move reconciliation from ${run.status} to ${args.status}`);
    const reason = args.reason?.trim();
    if (args.status === "void" && (!reason || reason.length < 8 || reason.length > 500)) throw new Error("Voiding a statement requires a reason between 8 and 500 characters");
    await ctx.db.patch(run._id, { status: args.status, voidReason: args.status === "void" ? reason : undefined, updatedBy: actor._id, updatedAt: Date.now() });
    await logAudit(ctx, { action: "platform.paymentReconciliation.statusChanged", entityTable: "platformPaymentReconciliationRuns", entityId: run._id, changedBy: actor._id, before: { status: run.status }, after: { status: args.status, reason: args.status === "void" ? reason : undefined } });
    return { status: args.status };
  },
});
