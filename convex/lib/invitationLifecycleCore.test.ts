import assert from "node:assert/strict";
import test from "node:test";
import {
  INVITATION_DEFAULT_EXPIRY_DAYS,
  decideInvitationRecovery,
  invitationRecoveryErrorMessage,
  isInvitableRole,
  normalizeInvitationEmail,
  resolveInvitationExpiryDays,
} from "./invitationLifecycleCore.ts";

test("only pending invitations can be re-issued", () => {
  assert.deepEqual(decideInvitationRecovery({ status: "pending" }), { allowed: true });
  assert.deepEqual(decideInvitationRecovery({ status: "accepted" }), { allowed: false, reason: "accepted" });
  assert.deepEqual(decideInvitationRecovery({ status: "revoked" }), { allowed: false, reason: "revoked" });
  assert.deepEqual(decideInvitationRecovery(null), { allowed: false, reason: "not_found" });
});

test("recovery errors stay product-safe", () => {
  assert.equal(invitationRecoveryErrorMessage("not_found"), "Invitation not found.");
  assert.equal(invitationRecoveryErrorMessage("accepted"), "This invitation has already been accepted.");
  assert.equal(invitationRecoveryErrorMessage("revoked"), "This invitation has already been revoked.");
});

test("emails are normalized and validated", () => {
  assert.equal(normalizeInvitationEmail("  Boss@Example.COM "), "boss@example.com");
  assert.equal(normalizeInvitationEmail(""), null);
  assert.equal(normalizeInvitationEmail("   "), null);
  assert.equal(normalizeInvitationEmail("no-at-sign"), null);
  assert.equal(normalizeInvitationEmail("a@b"), null);
  assert.equal(normalizeInvitationEmail("a@b."), null);
  assert.equal(normalizeInvitationEmail(`${"a".repeat(250)}@example.com`), null);
});

test("expiry days clamp into the supported window", () => {
  assert.equal(resolveInvitationExpiryDays(undefined), INVITATION_DEFAULT_EXPIRY_DAYS);
  assert.equal(resolveInvitationExpiryDays(null), INVITATION_DEFAULT_EXPIRY_DAYS);
  assert.equal(resolveInvitationExpiryDays(Number.NaN), INVITATION_DEFAULT_EXPIRY_DAYS);
  assert.equal(resolveInvitationExpiryDays(0), 1);
  assert.equal(resolveInvitationExpiryDays(-3), 1);
  assert.equal(resolveInvitationExpiryDays(14), 14);
  assert.equal(resolveInvitationExpiryDays(14.9), 14);
  assert.equal(resolveInvitationExpiryDays(99), 30);
});

test("custom roles need an explicit WorkOS slug to be invitable", () => {
  assert.equal(isInvitableRole({ slug: "ops", isSystem: true }), true);
  assert.equal(isInvitableRole({ slug: "billing", isSystem: false, workosRoleSlug: "org-billing" }), true);
  assert.equal(isInvitableRole({ slug: "billing", isSystem: false }), false);
  assert.equal(isInvitableRole({ slug: "ops", isSystem: true, deletedAt: 123 }), false);
  assert.equal(isInvitableRole({ slug: "platform_owner", isSystem: true }), false);
  assert.equal(isInvitableRole(null), false);
});
