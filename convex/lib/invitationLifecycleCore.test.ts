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

const PLATFORM_ORG = "org_platform";

test("only pending platform invitations can be re-issued", () => {
  assert.deepEqual(
    decideInvitationRecovery({ status: "pending", organizationId: PLATFORM_ORG }, PLATFORM_ORG),
    { allowed: true },
  );
  assert.deepEqual(
    decideInvitationRecovery({ status: "accepted", organizationId: PLATFORM_ORG }, PLATFORM_ORG),
    { allowed: false, reason: "accepted" },
  );
  assert.deepEqual(
    decideInvitationRecovery({ status: "revoked", organizationId: PLATFORM_ORG }, PLATFORM_ORG),
    { allowed: false, reason: "revoked" },
  );
  assert.deepEqual(decideInvitationRecovery(null, PLATFORM_ORG), { allowed: false, reason: "not_found" });
});

test("recovery refuses invitations from another workspace before revoking", () => {
  // Tenant and network invitations share the table through the WorkOS webhook.
  // Replacing one must never cancel its link or grant platform access.
  assert.deepEqual(
    decideInvitationRecovery({ status: "pending", organizationId: "org_tenant" }, PLATFORM_ORG),
    { allowed: false, reason: "other_workspace" },
  );
  assert.deepEqual(
    decideInvitationRecovery({ status: "pending", organizationId: "" }, PLATFORM_ORG),
    { allowed: false, reason: "other_workspace" },
  );
});

test("recovery errors stay product-safe", () => {
  assert.equal(invitationRecoveryErrorMessage("not_found"), "Invitation not found.");
  assert.equal(
    invitationRecoveryErrorMessage("other_workspace"),
    "This invitation is not part of the platform workspace.",
  );
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

test("only roles with an explicit WorkOS slug are invitable", () => {
  assert.equal(isInvitableRole({ slug: "ops_manager", workosRoleSlug: "ops_manager" }), true);
  assert.equal(isInvitableRole({ slug: "billing", workosRoleSlug: "org-billing" }), true);
  assert.equal(isInvitableRole({ slug: "billing" }), false);
  assert.equal(isInvitableRole({ slug: "billing", workosRoleSlug: "" }), false);
  // Synced-to-nothing system roles must never retire a valid link.
  assert.equal(isInvitableRole({ slug: "network_operator", isSystem: true }), false);
  assert.equal(isInvitableRole({ slug: "ops_manager", workosRoleSlug: "ops_manager", deletedAt: 123 }), false);
  assert.equal(isInvitableRole({ slug: "platform_owner", workosRoleSlug: "platform_owner" }), false);
  assert.equal(isInvitableRole(null), false);
  assert.equal(isInvitableRole(undefined), false);
});
