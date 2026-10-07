// Keep in sync with the owner-approved public KES prices in landing/components/PricingPlans.tsx.
export const PLATFORM_PLAN_PRICES_KES_MINOR: Readonly<Record<string, number>> = {
  starter: 50_000,
  growth: 140_000,
  pro: 350_000,
};

export const DEFAULT_PLATFORM_PLANS = [
  { code: "starter", name: "Starter", monthlyPriceMinor: 50_000 },
  { code: "growth", name: "Growth", monthlyPriceMinor: 140_000 },
  { code: "pro", name: "Pro", monthlyPriceMinor: 350_000 },
] as const;

export type RevenueTenant = {
  status: string;
  entitlement: { planId: string; status: string } | null;
};

export type PlatformRevenueRollup = {
  currency: "KES";
  mrrMinor: number;
  arrMinor: number;
  activeTenants: number;
  trialTenants: number;
  suspendedTenants: number;
  unpricedActiveTenants: number;
};

/** Contracted recurring revenue using the approved monthly list-price contract. */
export function calculatePlatformRevenue(
  tenants: RevenueTenant[],
  approvedPrices: Readonly<Record<string, number>> = PLATFORM_PLAN_PRICES_KES_MINOR,
): PlatformRevenueRollup {
  let mrrMinor = 0;
  let activeTenants = 0;
  let trialTenants = 0;
  let suspendedTenants = 0;
  let unpricedActiveTenants = 0;

  for (const tenant of tenants) {
    if (tenant.status === "suspended") {
      suspendedTenants += 1;
      continue;
    }
    if (tenant.status === "trial" || tenant.entitlement?.status === "trial") {
      trialTenants += 1;
      continue;
    }
    if (tenant.status !== "active" || tenant.entitlement?.status !== "active") continue;

    activeTenants += 1;
    const price = approvedPrices[tenant.entitlement.planId.trim().toLowerCase()];
    if (price === undefined) unpricedActiveTenants += 1;
    else mrrMinor += price;
  }

  return {
    currency: "KES",
    mrrMinor,
    arrMinor: mrrMinor * 12,
    activeTenants,
    trialTenants,
    suspendedTenants,
    unpricedActiveTenants,
  };
}
