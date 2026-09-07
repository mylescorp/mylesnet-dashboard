import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePermission } from "./lib/auth";

/**
 * FX provider (spec §28). Primary: open.er-api.com/v6/latest/USD (free, no key).
 * Fallback: Frankfurter (ECB) for the same currency pair. Rates are cached
 * per-date in `exchangeRates` and consumed by all financial rollups.
 */

const FALLBACK_RATE_TO_USD: Record<string, number> = { UGX: 1 / 3700, KSH: 1 / 129 };
const TRACKED = ["UGX", "KSH"];

export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Scale a USD rate (USD per 1 unit of the local currency). */
function toUsdRatePerUnit(localUnitsPerUsd: number): number {
  return Math.round((1 / localUnitsPerUsd) * 1e6) / 1e6;
}

async function fetchPrimaryRates(): Promise<Record<string, number> | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const body = (await res.json()) as { result?: string; rates?: Record<string, number> };
    if (body.result !== "success" || !body.rates) return null;
    const out: Record<string, number> = {};
    for (const ccy of TRACKED) {
      const perUsd = body.rates[ccy];
      if (perUsd && perUsd > 0) out[ccy] = toUsdRatePerUnit(perUsd);
    }
    return Object.keys(out).length ? out : null;
  } catch {
    return null;
  }
}

async function fetchFallbackRates(): Promise<Record<string, number> | null> {
  const out: Record<string, number> = {};
  for (const ccy of TRACKED) {
    try {
      const res = await fetch(`https://api.frankfurter.app/latest?from=USD&to=${ccy}`);
      if (!res.ok) return null;
      const body = (await res.json()) as { rates?: Record<string, number> };
      const perUsd = body.rates?.[ccy];
      if (!perUsd || perUsd <= 0) return null;
      out[ccy] = toUsdRatePerUnit(perUsd);
    } catch {
      return null;
    }
  }
  return Object.keys(out).length ? out : null;
}

export const refreshExchangeRates = internalAction({
  args: {},
  handler: async (ctx) => {
    const date = isoDate(new Date());
    let rates = await fetchPrimaryRates();
    let source: "primary" | "fallback" = "primary";
    if (!rates) {
      rates = await fetchFallbackRates();
      source = "fallback";
    }
    if (!rates) throw new Error("All FX providers unreachable");

    for (const [currency, rateToUSD] of Object.entries(rates)) {
      await ctx.runMutation(internal.forex.upsertRate, { date, currency, rateToUSD, source });
    }
    return { date, source, rates };
  },
});

export const upsertRate = internalMutation({
  args: { date: v.string(), currency: v.string(), rateToUSD: v.number(), source: v.union(v.literal("primary"), v.literal("fallback")) },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) => q.eq("currency", args.currency).eq("date", args.date))
      .first();
    if (existing) {
      await ctx.db.patch(existing._id, {
        rateToUSD: args.rateToUSD,
        source: args.source,
        refreshedAt: Date.now(),
      });
    } else {
      await ctx.db.insert("exchangeRates", {
        date: args.date,
        currency: args.currency,
        rateToUSD: args.rateToUSD,
        source: args.source,
        refreshedAt: Date.now(),
      });
    }
  },
});

/** Latest cached rate for a currency. */
export const getRate = internalQuery({
  args: { currency: v.string() },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("exchangeRates")
      .withIndex("by_currency_date", (q) => q.eq("currency", args.currency).eq("date", isoDate(new Date())))
      .first();
    return row ?? { date: isoDate(new Date()), currency: args.currency, rateToUSD: FALLBACK_RATE_TO_USD[args.currency] ?? 1, source: "fallback" as const };
  },
});

/** Admin-facing list of cached rates. */
export const listExchangeRates = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "financials:read");
    return (await ctx.db.query("exchangeRates").order("desc").take(args.limit ?? 30)).sort((a, b) => a.date.localeCompare(b.date));
  },
});

export { FALLBACK_RATE_TO_USD, TRACKED };
