"use client";

import { ConvexProvider } from "convex/react";
import { ConvexReactClient } from "@/app/lib/convex";
import { useQuery } from "@/app/lib/convex";
import Link from "next/link";
import { platformPlans, type PublicPlatformPlan } from "@/shared/convex/platformPlans";
import { DEFAULT_PLATFORM_PLANS } from "@/convex/lib/platformRevenueCore";
import { ArrowRight, Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import LandingCard from "@/landing/components/LandingCard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/ui/select";
import {
  CURRENCIES,
  formatPrice,
  type CurrencyCode,
} from "../content/rates";
import { useDisplayCurrency } from "@/landing/hooks/useDisplayCurrency";

export type Plan = {
  id: string;
  name: string;
  audience: string;
  priceKES: number;
  popular?: boolean;
  cta: string;
  features: string[];
};

const baselinePriceKES = (code: string) => {
  const plan = DEFAULT_PLATFORM_PLANS.find((candidate) => candidate.code === code);
  return plan ? plan.monthlyPriceMinor / 100 : 0;
};

const PLANS: Plan[] = [
  {
    id: "starter",
    name: "Starter",
    audience: "For single-site operators",
    priceKES: baselinePriceKES("starter"),
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
    priceKES: baselinePriceKES("growth"),
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
    priceKES: baselinePriceKES("pro"),
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

export const publicConvexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
export const publicConvex = publicConvexUrl ? new ConvexReactClient(publicConvexUrl) : null;

/**
 * The plan list as displayed: the approved list-price fallback (static, used
 * during SSR and when Convex is unreachable) or the live Convex override.
 */
export function toPlans(publicPlans: PublicPlatformPlan[] | undefined): Plan[] {
  if (publicPlans === undefined) return PLANS;
  return publicPlans.map((plan) => {
    const existing = PLANS.find((candidate) => candidate.id === plan.code);
    return {
      id: plan.code,
      name: plan.name,
      audience: existing?.audience ?? "For operators building reliable connectivity",
      priceKES: plan.monthlyPriceMinor / 100,
      popular: existing?.popular,
      cta: existing?.cta ?? `Get started with ${plan.name}`,
      features: existing?.features ?? [],
    };
  });
}

export default function PricingPlans() {
  if (!publicConvex) return <PricingPlansView publicPlans={undefined} />;
  return <ConvexProvider client={publicConvex}><ConnectedPricingPlans /></ConvexProvider>;
}

function ConnectedPricingPlans() {
  const publicPlans = useQuery(platformPlans.listPublic, {});
  return <PricingPlansView publicPlans={publicPlans} />;
}

function PricingPlansView({ publicPlans }: { publicPlans: PublicPlatformPlan[] | undefined }) {
  const [currency, setCurrency] = useDisplayCurrency();
  const plans: Plan[] = toPlans(publicPlans);

  return (
    <div className="landing-pricing">
      <div className="flex justify-center mb-8">
        <Select
          value={currency}
          onValueChange={(value) => setCurrency(value as CurrencyCode)}
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
        {plans.length === 0 ? <p className="text-center">Plan pricing is temporarily unavailable. Please contact the MylesNet team.</p> : plans.map((plan) => (
          <LandingCard
            key={plan.id}
            className="landing-plan-card"
            popular={plan.popular}
            meta={
              plan.popular ? (
                <span className="landing-plan-badge">Most popular</span>
              ) : null
            }
            title={<span className="landing-plan-name">{plan.name}</span>}
            body={<span className="landing-plan-audience">{plan.audience}</span>}
            footer={
              <Button asChild className="landing-plan-cta w-full">
                <Link href="/get-started">
                  {plan.cta}
                  <ArrowRight size={15} aria-hidden="true" />
                </Link>
              </Button>
            }
          >
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
          </LandingCard>
        ))}
      </div>
    </div>
  );
}
