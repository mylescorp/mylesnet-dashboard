export type CurrencyCode = "KES" | "UGX" | "USD";

export const CURRENCIES: { code: CurrencyCode; label: string }[] = [
  { code: "KES", label: "KES" },
  { code: "UGX", label: "UGX" },
  { code: "USD", label: "USD" },
];

/**
 * Cached reference-rate snapshot for public pricing display only.
 * KES is the approved base currency for MylesNet plans. No runtime FX
 * call is made (no new dependency) — update this snapshot through the
 * approved process and re-verify the pricing page before release.
 */
export const FX_SNAPSHOT = {
  asOf: "2026-09-10",
  base: "KES",
  /** Units of the target currency per 1 KES (historical cross-rate). */
  perKES: { KES: 1, UGX: 28, USD: 1 / 130 },
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