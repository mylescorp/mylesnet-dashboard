import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requireFinanceOrAbove, requirePermission } from "./lib/auth";
import { localToUsd, monthOf } from "./lib/finance";
import { logAudit } from "./lib/auditLog";
import type { Id } from "./_generated/dataModel";

export const EXPENSE_CATEGORIES = [
  "airtel_data",
  "electricity",
  "rent",
  "salaries",
  "fuel",
  "maintenance",
  "equipment",
  "other",
] as const;

export const EXPENSE_CATEGORY_VALIDATOR = v.union(
  ...EXPENSE_CATEGORIES.map((category) => v.literal(category))
);

export const listExpenses = query({
  args: {
    marketId: v.optional(v.id("markets")),
    month: v.optional(v.string()),
    category: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Markets/agents can see their own market's expenses; finance sees all.
    await requireFinanceOrAbove(ctx);
    let rows = await ctx.db.query("expenses").collect();
    if (args.marketId) rows = rows.filter((e) => e.marketId === args.marketId);
    if (args.month) rows = rows.filter((e) => e.month === args.month);
    if (args.category) rows = rows.filter((e) => e.category === args.category);
    return rows.sort((a, b) => b.enteredAt - a.enteredAt);
  },
});

export const recordExpense = mutation({
  args: {
    marketId: v.optional(v.id("markets")),
    category: v.union(...EXPENSE_CATEGORIES.map((category) => v.literal(category))),
    amountLocal: v.number(),
    currency: v.string(),
    type: v.union(v.literal("fixed"), v.literal("variable")),
    month: v.string(),
    receiptFileId: v.optional(v.id("_storage")),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "expenses:manage");
    if (args.amountLocal <= 0) throw new Error("Amount must be positive");
    const amountUSD = await localToUsd(ctx, args.amountLocal, args.currency, `${args.month}-01`);
    const id = await ctx.db.insert("expenses", {
      marketId: args.marketId,
      category: args.category,
      amountLocal: args.amountLocal,
      currency: args.currency,
      amountUSD,
      type: args.type,
      month: args.month,
      enteredBy: user._id,
      enteredAt: Date.now(),
      receiptFileId: args.receiptFileId,
      notes: args.notes,
    });
    await logAudit(ctx, {
      action: "expense.record",
      entityTable: "expenses",
      entityId: id,
      changedBy: user._id,
      after: { category: args.category, amountLocal: args.amountLocal, month: args.month },
    });
    return id;
  },
});

export const deleteExpense = mutation({
  args: { expenseId: v.id("expenses") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "expenses:manage");
    const expense = await ctx.db.get(args.expenseId);
    if (!expense) throw new Error("Expense not found");
    await ctx.db.delete(args.expenseId);
    await logAudit(ctx, {
      action: "expense.delete",
      entityTable: "expenses",
      entityId: args.expenseId,
      changedBy: user._id,
      before: { amountLocal: expense.amountLocal, month: expense.month },
    });
  },
});

// ---------------------------------------------------------------------------
// Market financials (spec §22)
// ---------------------------------------------------------------------------

function currencyTotals(rows: { amountLocal: number; currency: string }[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const row of rows) totals[row.currency] = (totals[row.currency] ?? 0) + row.amountLocal;
  return totals;
}

/**
 * Recompute the financial row for one market/month. Pure function of the
 * ledgers: revenue = agentActivity sales; variable cost = expenses in variable
 * categories for that month (airtel_data, electricity, fuel, maintenance);
 * centipid fee = platformFeeLocal accrued on the ledger.
 */
export const computeMarketFinancials = internalMutation({
  args: { marketId: v.id("markets"), month: v.string() },
  handler: async (ctx, args) => {
    const market = await ctx.db.get(args.marketId);
    if (!market) throw new Error("Market not found");

    const [yearStr, monthStr] = args.month.split("-");
    const from = new Date(Number(yearStr), Number(monthStr) - 1, 1).getTime();
    const to = new Date(Number(yearStr), Number(monthStr), 1).getTime();

    const activity = await ctx.db
      .query("agentActivity")
      .withIndex("by_market_time", (q) => q.eq("marketId", args.marketId))
      .filter((q) =>
        q.and(
          q.gte(q.field("occurredAt"), from),
          q.lt(q.field("occurredAt"), to)
        )
      )
      .collect();

    const revenueTotals = currencyTotals(activity);
    const revenueLocal = revenueTotals[market.currency] ?? 0;
    const platformFeeLocal = activity.reduce((sum, a) => sum + (a.platformFeeLocal ?? 0), 0);

    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_market_month", (q) => q.eq("marketId", args.marketId).eq("month", args.month))
      .collect();
    const variable = expenses.filter((e) => e.type === "variable");
    const varyingTotals = currencyTotals(variable);
    const variableCostLocal = varyingTotals[market.currency] ?? 0;

    // Distribute platform fee in local terms if it was recorded in local currency;
    // usually it is recorded in the market's currency already.
    const centipidFeeLocal = platformFeeLocal;

    const netContributionLocal = revenueLocal - variableCostLocal - centipidFeeLocal;
    const revenueUSD = await localToUsd(ctx, revenueLocal, market.currency, `${args.month}-01`);
    const breakEvenStatus: "profit" | "break_even" | "loss" =
      netContributionLocal > 0 ? "profit" : netContributionLocal === 0 ? "break_even" : "loss";

    const existing = await ctx.db
      .query("marketFinancials")
      .withIndex("by_market_month", (q) => q.eq("marketId", args.marketId).eq("month", args.month))
      .first();
    const row = {
      marketId: args.marketId,
      month: args.month,
      revenueLocal,
      revenueUSD,
      airtelCostLocal: varyingTotals[market.currency] ?? 0,
      electricityCostLocal: variable.find((e) => e.category === "electricity")?.amountLocal ?? 0,
      centipidFeeLocal,
      variableCostLocal,
      netContributionLocal,
      breakEvenStatus,
      currency: market.currency,
      enteredBy: "system" as unknown as Id<"users">,
      enteredAt: Date.now(),
    };
    if (existing) {
      await ctx.db.replace(existing._id, row);
      return { updated: true, id: existing._id, ...row };
    }
    const id = await ctx.db.insert("marketFinancials", row);
    return { updated: false, id, ...row };
  },
});

export const getMarketFinancials = query({
  args: { marketId: v.id("markets"), month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "financials:read");
    const rows = await ctx.db
      .query("marketFinancials")
      .withIndex("by_market_month", (q) => q.eq("marketId", args.marketId))
      .collect();
    return rows.filter((r) => !args.month || r.month === args.month).sort((a, b) => b.month.localeCompare(a.month));
  },
});

export const listAllFinancials = query({
  args: { month: v.optional(v.string()) },
  handler: async (ctx, args) => {
    await requireFinanceOrAbove(ctx);
    const rows = await ctx.db.query("marketFinancials").collect();
    return rows.filter((r) => !args.month || r.month === args.month).sort((a, b) => b.month.localeCompare(a.month));
  },
});

export { monthOf };
