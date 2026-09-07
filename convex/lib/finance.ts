import { internal } from "../_generated/api";
import type { MutationCtx } from "../_generated/server";

const FALLBACK_RATE_TO_USD: Record<string, number> = { UGX: 1 / 3700, KSH: 1 / 129 };

function isoDate(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/**
 * Convert a local amount to USD using the cached exchange rate for the given
 * date, falling back to the nearest stored rate then a static floor. Callable
 * from mutations and actions.
 */
export async function localToUsd(
  ctx: Pick<MutationCtx, "runQuery">,
  amountLocal: number,
  currency: string,
  forDate?: string,
): Promise<number> {
  if (amountLocal === 0) return 0;
  let rate: number | undefined;
  try {
    const row = await ctx.runQuery(internal.forex.getRate, { currency });
    rate = row?.rateToUSD;
  } catch {
    rate = undefined;
  }
  rate = rate ?? FALLBACK_RATE_TO_USD[currency] ?? 1;
  return Math.round(amountLocal * rate);
}

export function monthOf(timestamp: number): string {
  const d = new Date(timestamp);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/** "2026-08-14" for a timestamp. */
export function dayOf(timestamp: number): string {
  return isoDate(new Date(timestamp));
}
