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
