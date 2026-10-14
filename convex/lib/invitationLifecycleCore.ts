/**
 * Pure decision logic for recovering platform invitations (resend / replace).
 *
 * WorkOS invitations are immutable: an issued link cannot be re-sent or edited.
 * Recovering one therefore means revoking the existing WorkOS invitation and
 * issuing a fresh one for the (possibly changed) email and role. This module
 * owns the decisions that guard that operation so they can be unit-tested
 * without a WorkOS connection or a Convex runtime.
 */

/** Default invitation lifetime; matches the send form default. */
export const INVITATION_DEFAULT_EXPIRY_DAYS = 7;
export const INVITATION_MIN_EXPIRY_DAYS = 1;
export const INVITATION_MAX_EXPIRY_DAYS = 30;

export type InvitationStatus = "pending" | "accepted" | "revoked";

export type InvitationRecoveryReason = "not_found" | "accepted" | "revoked";

export type InvitationRecoveryDecision =
  | { allowed: true }
  | { allowed: false; reason: InvitationRecoveryReason };

/**
 * Only a pending invitation can be re-issued. Accepted invitations already
 * granted access (revoke the membership instead) and revoked ones were
 * deliberately retired (send a fresh invitation).
 */
export function decideInvitationRecovery(
  row: { status: InvitationStatus } | null,
): InvitationRecoveryDecision {
  if (!row) return { allowed: false, reason: "not_found" };
  if (row.status === "accepted") return { allowed: false, reason: "accepted" };
  if (row.status === "revoked") return { allowed: false, reason: "revoked" };
  return { allowed: true };
}

/** Product-safe explanation for a rejected recovery attempt. */
export function invitationRecoveryErrorMessage(reason: InvitationRecoveryReason): string {
  switch (reason) {
    case "not_found":
      return "Invitation not found.";
    case "accepted":
      return "This invitation has already been accepted.";
    case "revoked":
      return "This invitation has already been revoked.";
  }
}

/** Trim + lowercase an address and reject malformed or overlong values. */
export function normalizeInvitationEmail(value: string): string | null {
  const email = value.trim().toLowerCase();
  if (email.length === 0 || email.length > 254) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

/** Clamp a requested lifetime into the supported 1–30 day window. */
export function resolveInvitationExpiryDays(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return INVITATION_DEFAULT_EXPIRY_DAYS;
  const days = Math.trunc(value);
  if (days < INVITATION_MIN_EXPIRY_DAYS) return INVITATION_MIN_EXPIRY_DAYS;
  if (days > INVITATION_MAX_EXPIRY_DAYS) return INVITATION_MAX_EXPIRY_DAYS;
  return days;
}

export interface InvitableRoleShape {
  slug: string;
  isSystem: boolean;
  deletedAt?: number;
  workosRoleSlug?: string;
}

/**
 * A role is invitable when it is live, is not the bootstrap-only owner role,
 * and can be emitted as a WorkOS slug — either it was synced explicitly or it
 * is a system role whose slug is the WorkOS slug.
 */
export function isInvitableRole(role: InvitableRoleShape | null): boolean {
  if (!role || role.deletedAt !== undefined) return false;
  if (role.slug === "platform_owner") return false;
  return role.isSystem || Boolean(role.workosRoleSlug);
}
