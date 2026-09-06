import { v } from "convex/values";
import { query } from "./_generated/server";
import { requireFinanceOrAbove } from "./lib/auth";
import { localToUsd } from "./lib/finance";

/**
 * Cost allocation (spec §27): per-market contribution analysis. Monthly
 * variable costs belong to the market that incurred them; national fixed costs
 * (salaries, rent standalone, equipment) are shared pro-rata by revenue share.
 */
export const getCostAllocation = query({
  args: { month: v.string() },
  handler: async (ctx, args) => {
    await requireFinanceOrAbove(ctx);

    const financials = await ctx.db.query("marketFinancials").withIndex("by_month", (q) => q.eq("month", args.month)).collect();
    const expenses = await ctx.db.query("expenses").withIndex("by_month", (q) => q.eq("month", args.month)).collect();

    const byMarket = new Map<
      string,
      {
        marketId: string;
        revenueLocal: number;
        variableLocal: number;
        fixedLocal: number;
        currency: string;
      }
    >();
    let totalRevenueLocal = 0;
    const totalsByCurrency = new Map<string, number>();

    for (const row of expenses) {
      const key = row.marketId ?? "national";
      const entry = byMarket.get(key) ?? {
        marketId: key,
        revenueLocal: 0,
        variableLocal: 0,
        fixedLocal: 0,
        currency: row.currency,
      };
      if (row.type === "variable") entry.variableLocal += row.amountLocal;
      else entry.fixedLocal += row.amountLocal;
      byMarket.set(key, entry);
    }

    for (const fin of financials) {
      const entry = byMarket.get(fin.marketId) ?? {
        marketId: fin.marketId,
        revenueLocal: 0,
        variableLocal: 0,
        fixedLocal: 0,
        currency: fin.currency,
      };
      entry.revenueLocal = fin.revenueLocal;
      entry.currency = fin.currency;
      byMarket.set(fin.marketId, entry);
      totalRevenueLocal += fin.revenueLocal;
      totalsByCurrency.set(fin.currency, (totalsByCurrency.get(fin.currency) ?? 0) + fin.revenueLocal);
    }

    // National fixed costs are driven by currency; allocate a market its share
    // of national fixed costs for its own currency pool.
    const nationalEntry = byMarket.get("national");
    const allocated = Array.from(byMarket.entries())
      .filter(([key]) => key !== "national")
      .map(([marketId, entry]) => {
        const nationalFixedForCcy = nationalEntry?.currency === entry.currency ? nationalEntry.fixedLocal : 0;
        const ccyRevenue = totalsByCurrency.get(entry.currency) ?? 1;
        const fixedShare =
          ccyRevenue > 0 ? Math.round((entry.revenueLocal / ccyRevenue) * (nationalEntry?.fixedLocal ?? 0) * 100) / 100 : 0;
        const fixedLocal = entry.fixedLocal + fixedShare;
        return {
          marketId,
          revenueLocal: entry.revenueLocal,
          variableCostLocal: entry.variableLocal,
          fixedCostLocal: fixedLocal,
          netContributionLocal: Math.round((entry.revenueLocal - entry.variableLocal - fixedLocal) * 100) / 100,
          currency: entry.currency,
          nationalFixedAllocated: nationalFixedForCcy,
        };
      })
      .sort((a, b) => b.netContributionLocal - a.netContributionLocal);

    const totals = allocated.reduce(
      (acc, row) => {
        acc.revenueLocal += row.revenueLocal;
        acc.netContributionLocal += row.netContributionLocal;
        return acc;
      },
      { revenueLocal: 0, netContributionLocal: 0 },
    );

    const totalUsd = await localToUsd(ctx, totals.netContributionLocal, "KSH");

    return {
      month: args.month,
      markets: allocated,
      totals,
      totalsUsdNetContribution: totalUsd,
      national: nationalEntry
        ? {
            fixedLocal: nationalEntry.fixedLocal,
            currency: nationalEntry.currency,
          }
        : null,
    };
  },
});