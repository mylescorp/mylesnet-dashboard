/**
 * MFA policy for the MylesNet platform (Security Standards; WorkOS AuthKit
 * mandatory-2FA roles).
 *
 * Enforcement model: WorkOS owns enrollment (users authenticate through
 * AuthKit and enroll factors there). This module is the app-side mirror of
 * that policy: it decides which roles *require* a verified factor and reads
 * the enrollment marker that is synced into the `users` row when identity is
 * reconciled (see `convex/workos.ts` `getWorkosMfaEnrollment` +
 * `syncActiveOrganizationMembership`). Server guards fail closed — a mandatory-2FA role
 * without a synced enrollment marker is treated as non-compliant.
 */

export const MANDATORY_MFA_ROLES = [
  "platform_owner",
  "platform_admin",
  "ops_manager",
  "finance_manager",
] as const;

export type MandatoryMfaRole = (typeof MANDATORY_MFA_ROLES)[number];

export interface MfaGuardConfiguration {
  shadowMode?: boolean;
  enforcementLevel?: string;
}

/** True when the given role slug is subject to mandatory MFA enrollment. */
export function requiresMandatory2FA(roleSlug: string | null | undefined): boolean {
  return MANDATORY_MFA_ROLES.some((slug) => slug === roleSlug);
}

/**
 * True when the account record proves MFA compliance.
 *
 * `user.mfaEnrolledAt` is set from WorkOS at reconcile time. A missing marker
 * on a mandatory role is a policy violation; on non-mandatory roles a missing
 * marker is fine (opt-in MFA is still allowed).
 */
export function isMfaCompliant(
  roleSlugs: Array<string | null | undefined> | undefined,
  user: { mfaEnrolledAt?: number } | null | undefined,
): boolean {
  const needsMfa = (roleSlugs ?? []).some((slug) => requiresMandatory2FA(slug));
  if (!needsMfa) return true;
  return typeof user?.mfaEnrolledAt === "number" && user.mfaEnrolledAt > 0;
}

/** List the mandatory-2FA role slugs a set of roles actually includes. */
export function unmetMfaRoles(roleSlugs: Array<string | null | undefined>): string[] {
  return MANDATORY_MFA_ROLES.filter((slug) => roleSlugs.includes(slug));
}

/**
 * Guard-level enforcement shared by the Convex authorization guards. Keeping
 * this context-free makes the real fail-closed decision directly testable.
 */
export function assertMfaCompliance(
  enrollment: { mfaEnrolled?: boolean; mfaEnrolledAt?: number },
  roleSlugs: ReadonlyArray<string>,
  configuration: MfaGuardConfiguration = {},
): void {
  if (isMfaCompliant([...roleSlugs], enrollment)) return;

  const shadowMode = configuration.shadowMode ?? process.env.NEXT_PUBLIC_ENABLE_RBAC_SHADOW_MODE === "true";
  const level = configuration.enforcementLevel ?? process.env.NEXT_PUBLIC_RBAC_ENFORCEMENT_LEVEL ?? "full";
  if (shadowMode || level === "off" || level === "partial") return;

  const required = roleSlugs.filter((slug) => requiresMandatory2FA(slug));
  throw new Error(
    `Unauthorized: multi-factor authentication is required for role(s): ${required.join(", ")}`,
  );
}
