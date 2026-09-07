import { internalMutation } from "./_generated/server";

/**
 * Idempotent startup migrations folding legacy data into the NOC v2 tables.
 * Safe to run repeatedly (every step dedupes or no-ops). Wired into crons so a
 * fresh deploy self-heals without a manual step.
 *
 * 1. marketOperatingCosts -> expenses   (spec §27 ledger)
 * 2. voucherBatches.planType -> plans   (spec §26) + backfill planId
 * 3. seed floor exchange rates for UGX/KSH if none exist yet
 */

// Static floors so financial rollups work before the forex cron populates
// exchangeRates. Values refreshed by the live feed thereafter.
const FALLBACK_RATE_TO_USD: Record<string, number> = {
  UGX: 1 / 3700,
  KSH: 1 / 129,
};

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export const runStartupMigrations = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const results = { operatingCosts: 0, plans: 0, planLinks: 0, exchangeRates: 0 };

    // --- 1. Fold marketOperatingCosts rows into the expenses ledger ----------
    const legacy = await ctx.db.query("marketOperatingCosts").collect();
    for (const row of legacy) {
      const existing = await ctx.db
        .query("expenses")
        .withIndex("by_market_month", (q) =>
          q.eq("marketId", row.marketId).eq("month", row.yearMonth),
        )
        .filter((q) => q.eq(q.field("category"), "airtel_data"))
        .filter((q) => q.eq(q.field("notes"), "migrated from marketOperatingCosts"))
        .first();
      if (existing) continue;

      const rate = FALLBACK_RATE_TO_USD[row.currency] ?? FALLBACK_RATE_TO_USD.KSH;
      const expenses: {
        marketId: string;
        category: string;
        amountLocal: number;
        currency: string;
        amountUSD: number;
        type: string;
        month: string;
        enteredBy: string;
        enteredAt: number;
        notes?: string;
      }[] = [
        {
          marketId: row.marketId,
          category: "airtel_data",
          amountLocal: row.airtelDataCost,
          currency: row.currency,
          amountUSD: Math.round(row.airtelDataCost * rate),
          type: "variable",
          month: row.yearMonth,
          enteredBy: row.reportedBy,
          enteredAt: row.reportedAt,
          notes: "migrated from marketOperatingCosts",
        },
      ];
      if (row.electricityCost > 0) {
        expenses.push({
          marketId: row.marketId,
          category: "electricity",
          amountLocal: row.electricityCost,
          currency: row.currency,
          amountUSD: Math.round(row.electricityCost * rate),
          type: "variable",
          month: row.yearMonth,
          enteredBy: row.reportedBy,
          enteredAt: row.reportedAt,
          notes: "migrated from marketOperatingCosts",
        });
      }
      for (const entry of expenses) {
        await ctx.db.insert("expenses", {
          marketId: entry.marketId as never,
          category: entry.category as never,
          amountLocal: entry.amountLocal,
          currency: entry.currency,
          amountUSD: entry.amountUSD,
          type: entry.type as never,
          month: entry.month,
          enteredBy: entry.enteredBy as never,
          enteredAt: entry.enteredAt,
          notes: entry.notes,
        } as never);
      }
      results.operatingCosts += 1;
    }

    // --- 2. Seed plans from voucherBatches + backfill batch.planId -----------
    const owner = await ctx.db
      .query("users")
      .filter((q) =>
        q.or(
          q.eq(q.field("platformRole"), "platform_owner"),
          q.eq(q.field("platformRole"), "platform_admin"),
        ),
      )
      .first();
    if (owner) {
      const batches = await ctx.db.query("voucherBatches").collect();
      const seen = new Set<string>();
      for (const batch of batches.sort((a, b) => a.createdAt - b.createdAt)) {
        const code = `${batch.planType}-${batch.marketId}`;
        if (seen.has(code)) continue;
        seen.add(code);
        const existing = await ctx.db
          .query("plans")
          .withIndex("by_code", (q) => q.eq("code", code))
          .first();
        if (!existing) {
          await ctx.db.insert("plans", {
            marketId: batch.marketId,
            code,
            name: batch.planType.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
            category: "data",
            priceLocal: batch.priceEach,
            currency: batch.currency,
            durationLabel: batch.planType,
            status: "active",
            createdBy: owner._id,
            createdAt: now,
          });
          results.plans += 1;
        }
        if (!batch.planId) {
          const plan = await ctx.db
            .query("plans")
            .withIndex("by_code", (q) => q.eq("code", code))
            .first();
          if (plan) {
            await ctx.db.patch(batch._id, { planId: plan._id });
            results.planLinks += 1;
          }
        }
      }
    }

    // --- 3. Seed floor exchange rates for today if the table is empty --------
    const anyRate = await ctx.db.query("exchangeRates").first();
    if (!anyRate) {
      for (const [currency, rate] of Object.entries(FALLBACK_RATE_TO_USD)) {
        const existing = await ctx.db
          .query("exchangeRates")
          .withIndex("by_currency_date", (q) =>
            q.eq("currency", currency).eq("date", todayIso()),
          )
          .first();
        if (existing) continue;
        await ctx.db.insert("exchangeRates", {
          date: todayIso(),
          currency,
          rateToUSD: Math.round(rate * 1e6) / 1e6,
          source: "fallback",
          refreshedAt: now,
        });
        results.exchangeRates += 1;
      }
    }

    return results;
  },
});
