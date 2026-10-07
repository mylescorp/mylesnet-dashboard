export type CurrencyCode = "KES" | "UGX" | "USD";

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "KES", label: "KES" },
  { code: "UGX", label: "UGX" },
  { code: "USD", label: "USD" },
];

/**
 * Cached reference-rate snapshot for public pricing estimates only.
 * KES is the pricing base currency. Values are CBK commercial-bank average
 * closing rates dated 2026-10-06; they are indicative, not contract rates.
 * No runtime FX call is made. Update through the approved process and
 * re-verify the pricing page before release.
 */
export const FX_SNAPSHOT = {
  asOf: "2026-10-06",
  base: "KES",
  /** Units of the target currency per 1 KES (indicative cross-rate). */
  perKES: { KES: 1, UGX: 31.21, USD: 1 / 129.89 },
} as const;

export function formatPrice(priceKES: number, currency: CurrencyCode): string {
  const value = priceKES * FX_SNAPSHOT.perKES[currency];
  switch (currency) {
    case "KES":
      return `KSh ${formatWhole(value)}`;
    case "UGX":
      return `USh ${formatWhole(value)}`;
    case "USD":
      return `$${value.toFixed(2)}`;
  }
}

function formatWhole(value: number): string {
  return new Intl.NumberFormat("en-KE").format(Math.round(value));
}
