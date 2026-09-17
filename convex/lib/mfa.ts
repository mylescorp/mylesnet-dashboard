/**
 * Optional MFA policy for MylesNet.
 *
 * Enforcement model: WorkOS owns enrollment (users authenticate through
 * AuthKit and enroll factors there). This module is the app-side mirror of
 * policy: it exposes whether a user has chosen to enrol a factor and reads the
 * marker synced into the `users` row when identity is reconciled. MFA is a
 * user-controlled account-security option; it never authorizes or blocks a
 * MylesNet panel, mutation, or onboarding workflow.
 */

export const MFA_ENFORCEMENT_MODE = "optional" as const;
/** Retained as a compatibility export; no role is mandatory in optional mode. */
export const MANDATORY_MFA_ROLES = [] as const;

export type MandatoryMfaRole = (typeof MANDATORY_MFA_ROLES)[number];

export interface MfaGuardConfiguration {
  shadowMode?: boolean;
  enforcementLevel?: string;
}

/** MFA is optional for every role. */
export function requiresMandatory2FA(roleSlug: string | null | undefined): boolean {
  void roleSlug;
  return false;
}

/**
 * There is no MFA compliance gate in optional mode. Enrollment is still
 * recorded and surfaced as a personal security preference.
 */
export function isMfaCompliant(
  roleSlugs: Array<string | null | undefined> | undefined,
  user: { mfaEnrolledAt?: number } | null | undefined,
): boolean {
  void roleSlugs;
  void user;
  return true;
}

/** No role requires MFA in optional mode. */
export function unmetMfaRoles(roleSlugs: Array<string | null | undefined>): string[] {
  void roleSlugs;
  return [];
}

/**
 * Backward-compatible no-op for existing callers. Authorization remains based
 * on identity, role, active account, and tenant scope — never MFA enrollment.
 */
export function assertMfaCompliance(
  enrollment: { mfaEnrolled?: boolean; mfaEnrolledAt?: number },
  roleSlugs: ReadonlyArray<string>,
  configuration: MfaGuardConfiguration = {},
): void {
  void enrollment;
  void roleSlugs;
  void configuration;
}
