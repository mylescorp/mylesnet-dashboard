export const BUILT_IN_REFERRAL_RATE_BASIS_POINTS = 2000;
export const BUILT_IN_REFERRAL_DURATION_MONTHS = 12;

export type CommissionRatePolicy = { rateBasisPoints: number; durationMonths: number };

export function validateCommissionRatePolicy(rateBasisPoints: number, durationMonths: number): CommissionRatePolicy {
  if (!Number.isInteger(rateBasisPoints) || rateBasisPoints < 0 || rateBasisPoints > 10_000) {
    throw new Error("Commission rate must be between 0% and 100%, in 0.01% increments");
  }
  if (!Number.isInteger(durationMonths) || durationMonths < 1 || durationMonths > 60) {
    throw new Error("Commission duration must be between 1 and 60 months");
  }
  return { rateBasisPoints, durationMonths };
}

export function resolveCommissionRatePolicy(
  global: CommissionRatePolicy | undefined,
  agencyOverride: CommissionRatePolicy | undefined,
): CommissionRatePolicy {
  return agencyOverride ?? global ?? {
    rateBasisPoints: BUILT_IN_REFERRAL_RATE_BASIS_POINTS,
    durationMonths: BUILT_IN_REFERRAL_DURATION_MONTHS,
  };
}
