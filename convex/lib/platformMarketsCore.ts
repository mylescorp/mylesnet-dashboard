import type { Id } from "../_generated/dataModel";

export function normalizeMarketInput(input: { name: string; country: string; currency: string }) {
  const name = input.name.trim();
  const country = input.country.trim();
  const currency = input.currency.trim().toUpperCase();
  if (!name || name.length > 120 || !country || country.length > 120) {
    throw new Error("Market name and country must be between 1 and 120 characters");
  }
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("Currency must be a three-letter ISO code");
  return { name, country, currency };
}

export function assertMarketBelongsToTenant(
  market: { tenantId?: Id<"tenants"> } | null,
  tenantId: Id<"tenants">,
): asserts market is { tenantId: Id<"tenants"> } {
  if (!market || market.tenantId !== tenantId) throw new Error("Market not found for this tenant");
}

export function assertNoActiveMarketAssignments(activeAssignmentCount: number) {
  if (activeAssignmentCount > 0) {
    throw new Error(`Market has ${activeAssignmentCount} active assignment(s); reassign them before archiving it`);
  }
}
