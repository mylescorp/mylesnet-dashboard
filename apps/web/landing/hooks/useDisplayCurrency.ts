"use client";

import { useState, useSyncExternalStore } from "react";
import type { CurrencyCode } from "@/landing/content/rates";

/** No store to subscribe to — the "store" is the immutable browser locale. */
const subscribeNoop = () => () => {};

function clientLanguage(): string {
  return navigator.language;
}

function serverLanguage(): string {
  return "";
}

/**
 * Map a BCP-47 language tag to the displayed currency: KES is the approved
 * base (and the fallback when no region is known, e.g. during SSR), UGX for
 * Uganda, USD elsewhere.
 */
export function currencyFromLanguage(language: string): CurrencyCode {
  try {
    const region = new Intl.Locale(language).region?.toUpperCase();
    if (region === "KE") return "KES";
    if (region === "UG") return "UGX";
    if (region) return "USD";
  } catch {
    // Malformed or unavailable locale — fall through to the KES base.
  }
  return "KES";
}

/**
 * The currency shown to this visitor, seeded from their browser region once
 * the client mounts (the server always renders the KES base, so there is no
 * hydration mismatch), plus a setter for an explicit switcher choice.
 */
export function useDisplayCurrency(): [CurrencyCode, (value: CurrencyCode) => void] {
  const [choice, setChoice] = useState<CurrencyCode | null>(null);
  const language = useSyncExternalStore(subscribeNoop, clientLanguage, serverLanguage);
  return [choice ?? currencyFromLanguage(language), setChoice];
}
