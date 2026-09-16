"use client";

import { useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CURRENCIES,
  formatPrice,
  type CurrencyCode,
} from "../content/rates";

type Plan = {
  id: string;
  name: string;
  audience: string;
  priceKES: number;
  popular?: boolean;
  cta: string;
  features: string[];
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "For single-site operators",
    priceKES: 500,
    cta: "Get started with Starter",
    features: [
      "One location",
      "Core customer accounts",
      "Package and voucher sales",
      "Payment recording",
      "Basic analytics",
      "Standard support",
    ],
  },
  {
    id: "growth",
    name: "Growth",
    audience: "For growing operators",
    priceKES: 1400,
    popular: true,
    cta: "Get started with Growth",
    features: [
      "Multiple locations",
      "Full analytics and reports",
      "CSV exports",
      "SMS reminders (coming soon)",
      "Staff roles",
      "Priority support",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    audience: "For multi-site or franchise operators",
    priceKES: 3500,
    cta: "Talk to us about Pro",
    features: [
      "Unlimited locations",
      "White-label controls",
      "API access",
      "Advanced integrations",
      "Dedicated support",
    ],
  },
];

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
function currencyFromLanguage(language: string): CurrencyCode {
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

export default function PricingPlans() {
  const [currencyChoice, setCurrencyChoice] = useState<CurrencyCode | null>(null);

  // The browser region only exists on the client: read it via
  // useSyncExternalStore so the server renders the KES base and the client
  // settles on the visitor's region after hydration, without a mismatch.
  const language = useSyncExternalStore(subscribeNoop, clientLanguage, serverLanguage);
  const currency = currencyChoice ?? currencyFromLanguage(language);

  return (
    <div className="landing-pricing">
      <div className="flex justify-center mb-8">
        <Select
          value={currency}
          onValueChange={(value) => setCurrencyChoice(value as CurrencyCode)}
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Currency" />
          </SelectTrigger>
          <SelectContent>
            {CURRENCIES.map(({ code, label }) => (
              <SelectItem key={code} value={code}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="landing-plans-grid">
        {PLANS.map((plan) => (
          <article
            key={plan.id}
            className={
              plan.popular
                ? "landing-plan-card landing-plan-card-popular"
                : "landing-plan-card"
            }
          >
            {plan.popular ? (
              <span className="landing-plan-badge">Most popular</span>
            ) : null}
            <h3 className="landing-plan-name">{plan.name}</h3>
            <p className="landing-plan-audience">{plan.audience}</p>
            <div className="landing-plan-price">
              <span className="landing-plan-price-value">
                {formatPrice(plan.priceKES, currency)}
              </span>
              <span className="landing-plan-price-period">per month</span>
            </div>
            <ul className="landing-plan-features">
              {plan.features.map((feature) => (
                <li key={feature}>
                  <Check size={15} aria-hidden="true" />
                  {feature}
                </li>
              ))}
            </ul>
            <Button asChild className="landing-plan-cta w-full">
              <Link href="/get-started">
                {plan.cta}
                <ArrowRight size={15} aria-hidden="true" />
              </Link>
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}
