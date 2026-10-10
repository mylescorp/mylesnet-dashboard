export const PLATFORM_SLA_FALLBACK = {
  network: { firstResponseMinutes: 15, resolutionMinutes: 240 },
  billing: { firstResponseMinutes: 60, resolutionMinutes: 2880 },
  account: { firstResponseMinutes: 120, resolutionMinutes: 4320 },
} as const;

export type PlatformTicketCategory = keyof typeof PLATFORM_SLA_FALLBACK;

export function ticketDeadlines(
  now: number,
  targets: { firstResponseMinutes: number; resolutionMinutes: number },
) {
  return {
    firstResponseDueAt: now + targets.firstResponseMinutes * 60_000,
    resolutionDueAt: now + targets.resolutionMinutes * 60_000,
  };
}

export type SlaTargets = { firstResponseMinutes: number; resolutionMinutes: number };

export function validateSlaTargets(targets: SlaTargets): void {
  for (const [label, value] of [["First response", targets.firstResponseMinutes], ["Resolution", targets.resolutionMinutes]] as const) {
    if (!Number.isSafeInteger(value) || value < 1 || value > 525_600) {
      throw new Error(`${label} target must be a whole number between 1 minute and 365 days`);
    }
  }
  if (targets.resolutionMinutes < targets.firstResponseMinutes) {
    throw new Error("Resolution target must be at least as long as first response target");
  }
}

export function effectiveSlaTargets(
  overrides: Partial<Record<PlatformTicketCategory, SlaTargets>>,
): Record<PlatformTicketCategory, SlaTargets> {
  return {
    network: overrides.network ?? PLATFORM_SLA_FALLBACK.network,
    billing: overrides.billing ?? PLATFORM_SLA_FALLBACK.billing,
    account: overrides.account ?? PLATFORM_SLA_FALLBACK.account,
  };
}

export function assertSlaPriority(
  category: PlatformTicketCategory,
  candidate: SlaTargets,
  current: Record<PlatformTicketCategory, SlaTargets>,
): void {
  if (category === "network") {
    for (const otherCategory of ["billing", "account"] as const) {
      if (candidate.firstResponseMinutes > current[otherCategory].firstResponseMinutes || candidate.resolutionMinutes > current[otherCategory].resolutionMinutes) {
        throw new Error("Network SLA targets must be at least as fast as billing and account targets");
      }
    }
  } else if (
    candidate.firstResponseMinutes < current.network.firstResponseMinutes ||
    candidate.resolutionMinutes < current.network.resolutionMinutes
  ) {
    throw new Error("Network tickets must have the fastest response and resolution targets");
  }
}
