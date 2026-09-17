/** Server-side validation for registration of an already verified tenant org. */
export interface TenantRegistrationInput {
  name: string;
  slug: string;
  country: string;
  timezone: string;
  currency: string;
  workosOrganizationId: string;
  ownerWorkosUserId: string;
}

/** User-facing input for the automatic tenant onboarding workflow. */
export interface AutomatedTenantOnboardingInput {
  name: string;
  slug: string;
  country: string;
  timezone: string;
  currency: string;
  ownerEmail: string;
  ownerName?: string;
}

export function normalizeAutomatedTenantOnboarding(
  input: AutomatedTenantOnboardingInput,
): AutomatedTenantOnboardingInput {
  const normalized = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    country: input.country.trim().toUpperCase(),
    timezone: input.timezone.trim(),
    currency: input.currency.trim().toUpperCase(),
    ownerEmail: input.ownerEmail.trim().toLowerCase(),
    ownerName: input.ownerName?.trim() || undefined,
  };
  if (normalized.name.length < 2 || normalized.name.length > 120) throw new Error("Tenant name must be 2–120 characters");
  if (!/^[a-z0-9-]{3,50}$/.test(normalized.slug)) throw new Error("Tenant slug must use 3–50 lowercase letters, numbers, or hyphens");
  if (!/^[A-Z]{2}$/.test(normalized.country)) throw new Error("Tenant country must be a two-letter ISO code");
  if (!/^[A-Z]{3}$/.test(normalized.currency)) throw new Error("Tenant currency must be a three-letter ISO code");
  if (!normalized.timezone) throw new Error("Tenant timezone is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.ownerEmail)) throw new Error("Enter a valid administrator email address");
  if (normalized.ownerName && normalized.ownerName.length > 120) throw new Error("Administrator name must be 120 characters or fewer");
  return normalized;
}

/** Stable provider-side key that makes a retry discover the same organization. */
export function tenantOrganizationExternalId(slug: string): string {
  return `mylesnet-tenant-${slug}`;
}

export function normalizeTenantRegistration(input: TenantRegistrationInput): TenantRegistrationInput {
  const normalized = {
    name: input.name.trim(),
    slug: input.slug.trim().toLowerCase(),
    country: input.country.trim().toUpperCase(),
    timezone: input.timezone.trim(),
    currency: input.currency.trim().toUpperCase(),
    workosOrganizationId: input.workosOrganizationId.trim(),
    ownerWorkosUserId: input.ownerWorkosUserId.trim(),
  };
  if (normalized.name.length < 2 || normalized.name.length > 120) throw new Error("Tenant name must be 2–120 characters");
  if (!/^[a-z0-9-]{3,50}$/.test(normalized.slug)) throw new Error("Tenant slug must use 3–50 lowercase letters, numbers, or hyphens");
  if (!/^[A-Z]{2}$/.test(normalized.country)) throw new Error("Tenant country must be a two-letter ISO code");
  if (!/^[A-Z]{3}$/.test(normalized.currency)) throw new Error("Tenant currency must be a three-letter ISO code");
  if (!normalized.timezone) throw new Error("Tenant timezone is required");
  if (!/^org_[A-Za-z0-9]+$/.test(normalized.workosOrganizationId)) throw new Error("A valid WorkOS organization ID is required");
  if (!/^user_[A-Za-z0-9]+$/.test(normalized.ownerWorkosUserId)) throw new Error("A valid WorkOS owner user ID is required");
  return normalized;
}
