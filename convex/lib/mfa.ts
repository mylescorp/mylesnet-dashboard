/**
 * MFA policy for MylesNet platform roles.
 *
 * Enforcement model: WorkOS owns enrollment (users authenticate through
 * AuthKit and enroll factors there). This module is the app-side mirror of
 * policy: it reads the marker synced into the `users` row when identity is
 * reconciled and fails closed for a platform role that has not enrolled a
 * factor. Approved policy (2026-10-12): MFA is mandatory for every platform
 * role. The single approved sources are `docs/auth/README.md` and
 * `docs/decisions.md`; see the session policy there too (30-minute inactivity
 * timeout, 25-minute warning, 12-hour absolute lifetime).
 */

import { SYSTEM_ROLES } from "./permissions.ts";

export const MFA_ENFORCEMENT_MODE = "required" as const;

/**
 * Every platform role declared in the role registry requires MFA enrollment.
 * Derived from `SYSTEM_ROLES` so a new platform role inherits the requirement
 * instead of silently escaping the gate.
 */
export const MANDATORY_MFA_ROLES: readonly string[] = SYSTEM_ROLES.filter(
  (role) => role.isPlatform,
).map((role) => role.slug);

export type MandatoryMfaRole = (typeof MANDATORY_MFA_ROLES)[number];

export interface MfaGuardConfiguration {
  /** Shadow mode records nothing and returns; only for rollout transitions. */
  shadowMode?: boolean;
  enforcementLevel?: string;
}

export interface MfaEnrollment {
  mfaEnrolled?: boolean;
  mfaEnrolledAt?: number;
}

/** Whether a role slug is a platform role that requires mandatory MFA. */
export function requiresMandatory2FA(roleSlug: string | null | undefined): boolean {
  return (MANDATORY_MFA_ROLES as readonly string[]).includes(roleSlug ?? "");
}

function hasEnrolledFactor(enrollment: MfaEnrollment | null | undefined): boolean {
  if (!enrollment) return false;
  // An explicit `false` is an authoritative "no factor enrolled", even when a
  // stale `mfaEnrolledAt` remains; the timestamp must never override it.
  if (enrollment.mfaEnrolled === false) return false;
  return enrollment.mfaEnrolled === true || enrollment.mfaEnrolledAt !== undefined;
}

/**
 * A user is MFA-compliant when they hold no mandatory platform role or have
 * enrolled a factor. An empty role list never counts as compliance for a
 * platform role.
 */
export function isMfaCompliant(
  roleSlugs: Array<string | null | undefined> | undefined,
  enrollment: MfaEnrollment | null | undefined,
): boolean {
  if (!roleSlugs || roleSlugs.length === 0) return true;
  if (!roleSlugs.some(requiresMandatory2FA)) return true;
  return hasEnrolledFactor(enrollment);
}

/** The mandatory platform roles the user holds without MFA enrollment. */
export function unmetMfaRoles(
  roleSlugs: Array<string | null | undefined>,
  enrollment: MfaEnrollment | null | undefined,
): string[] {
  if (hasEnrolledFactor(enrollment)) return [];
  return roleSlugs.filter(requiresMandatory2FA) as string[];
}

/**
 * Fail-closed MFA guard for a resolved roles list. Throws when the user holds
 * a mandatory platform role without MFA enrollment. Shadow mode returns
 * without blocking and is only for approved rollout transitions.
 */
export function assertMfaCompliance(
  enrollment: MfaEnrollment | null | undefined,
  roleSlugs: ReadonlyArray<string>,
  configuration: MfaGuardConfiguration = {},
): void {
  if (configuration.shadowMode) return;
  const unmet = unmetMfaRoles(roleSlugs as Array<string | null | undefined>, enrollment);
  if (unmet.length > 0) {
    throw new Error("Unauthorized: MFA enrollment is required for platform access");
  }
}
