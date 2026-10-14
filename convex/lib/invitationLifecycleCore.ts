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

export type InvitationRecoveryReason =
  | "not_found"
  | "other_workspace"
  | "accepted"
  | "revoked";

export type InvitationRecoveryDecision =
  | { allowed: true }
  | { allowed: false; reason: InvitationRecoveryReason };

/**
 * Outcome of a recovery attempt. `revoked_without_replacement` means the old
 * WorkOS link was retired but the replacement could not be issued: callers must
 * surface approved copy instead of treating the attempt as a silent failure.
 */
export type InvitationRecoveryOutcome =
  | { outcome: "issued"; workosInvitationId: string }
  | { outcome: "revoked_without_replacement" };

/**
 * Only a pending invitation in the platform workspace can be re-issued.
 *
 * The invitations table also receives tenant and network rows through the
 * WorkOS webhook. Replacing one of those would cancel its original workspace
 * invitation and issue platform access instead, so the workspace check runs
 * before anything is revoked. Accepted invitations already granted access
 * (revoke the membership instead) and revoked ones were deliberately retired
 * (send a fresh invitation).
 */
export function decideInvitationRecovery(
  row: { status: InvitationStatus; organizationId: string } | null,
  platformOrganizationId: string,
): InvitationRecoveryDecision {
  if (!row) return { allowed: false, reason: "not_found" };
  if (row.organizationId !== platformOrganizationId) {
    return { allowed: false, reason: "other_workspace" };
  }
  if (row.status === "accepted") return { allowed: false, reason: "accepted" };
  if (row.status === "revoked") return { allowed: false, reason: "revoked" };
  return { allowed: true };
}

/** Product-safe explanation for a rejected recovery attempt. */
export function invitationRecoveryErrorMessage(reason: InvitationRecoveryReason): string {
  switch (reason) {
    case "not_found":
      return "Invitation not found.";
    case "other_workspace":
      return "This invitation is not part of the platform workspace.";
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

/** Clamp an invitation lifetime into the window the send form supports. */
export function resolveInvitationExpiryDays(value: number | null | undefined): number {
  if (value === undefined || value === null || !Number.isFinite(value)) return INVITATION_DEFAULT_EXPIRY_DAYS;
  const days = Math.floor(value);
  if (days < INVITATION_MIN_EXPIRY_DAYS) return INVITATION_MIN_EXPIRY_DAYS;
  if (days > INVITATION_MAX_EXPIRY_DAYS) return INVITATION_MAX_EXPIRY_DAYS;
  return days;
}

export type InvitableRole = {
  slug: string;
  deletedAt?: number;
  workosRoleSlug?: string | null;
  isSystem?: boolean;
};

/**
 * A role can be invited only when it carries an explicit WorkOS slug.
 *
 * The owner role is claimed through bootstrap, and system roles that are not
 * mirrored to WorkOS (for example `network_operator`) have no slug. Rejecting
 * them here keeps `replaceInvitation` from retiring a live link and then
 * failing to issue its replacement.
 */
export function isInvitableRole(role: InvitableRole | null | undefined): boolean {
  if (!role || role.deletedAt !== undefined) return false;
  if (role.slug === "platform_owner") return false;
  return typeof role.workosRoleSlug === "string" && role.workosRoleSlug.length > 0;
}
