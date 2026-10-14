import { v } from "convex/values";
import { action, query, type ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { workosSlugForRole } from "./lib/permissions";
import {
  decideInvitationRecovery,
  invitationRecoveryErrorMessage,
  isInvitableRole,
  normalizeInvitationEmail,
  resolveInvitationExpiryDays,
  type InvitationRecoveryOutcome,
} from "./lib/invitationLifecycleCore";
import { platformOrganizationIdForRoleSync, createWorkosInvitation, revokeWorkosInvitation } from "./workos";

type InvitationAuthor = {
  userId: Id<"users">;
  workosUserId: string | null;
  primaryRoleName: string | null;
};

/**
 * Recover a pending invitation by revoking its WorkOS link and issuing a fresh
 * one for the (possibly updated) email and role.
 *
 * WorkOS invitations cannot be re-sent in place, so "resend" and "replace" are
 * the same operation with different inputs. The retired invitation is kept in
 * the local registry as `revoked` so the history is complete.
 *
 * The remote calls cannot join a Convex transaction, so the local state is
 * written in two atomic steps: an intent entry before the first remote call, and
 * a completion entry that retires the old row, registers the replacement, and
 * appends the audit entry in one transaction. If the replacement cannot be
 * issued after the revoke, the partial outcome is recorded and returned as
 * `revoked_without_replacement` so the caller can show approved recovery copy.
 */
async function reissueInvitation(
  ctx: ActionCtx,
  options: {
    author: InvitationAuthor;
    previous: Doc<"invitations">;
    email: string;
    roleId: Id<"roles">;
    roleSlug: string;
    expiresInDays: number;
    auditAction: "invitation.resend" | "invitation.replace";
  },
): Promise<InvitationRecoveryOutcome> {
  const platformOrganizationId = platformOrganizationIdForRoleSync();
  const previousRow = {
    workosInvitationId: options.previous.workosInvitationId,
    email: options.previous.email,
    organizationId: options.previous.organizationId,
    roleId: options.previous.roleId,
    roleSlug: options.previous.roleSlug,
    createdAt: options.previous.createdAt,
    expiresAt: options.previous.expiresAt,
  };

  // 1. Record the intent before the first remote call. If the WorkOS revoke
  //    succeeds and the completion write fails, the attempt is still visible
  //    for review instead of leaving an unexplained gap.
  await ctx.runMutation(internal.invitationsInternal.logInvitationAudit, {
    action: `${options.auditAction}_requested`,
    workosInvitationId: options.previous.workosInvitationId,
    email: options.email,
    roleSlug: options.roleSlug,
    actorUserId: options.author.userId,
    previousWorkosInvitationId: options.previous.workosInvitationId,
    previousEmail: options.previous.email,
    previousRoleSlug: options.previous.roleSlug,
    outcome: "recovery_requested",
  });

  // 2. Retire the existing link so only one can ever be live.
  await revokeWorkosInvitation(options.previous.workosInvitationId);

  // 3. Issue the replacement.
  let issued: { id: string; organizationId: string; expiresAt: number | undefined; status: "pending" | "accepted" };
  try {
    const invitation = await createWorkosInvitation(
      options.email,
      platformOrganizationId,
      options.roleSlug,
      options.expiresInDays,
    );
    issued = {
      id: invitation.id,
      organizationId: invitation.organization_id ?? platformOrganizationId,
      expiresAt: invitation.expires_at ? Date.parse(invitation.expires_at) || undefined : undefined,
      status: invitation.state === "accepted" ? "accepted" : "pending",
    };
  } catch {
    await ctx.runMutation(internal.invitationsInternal.recoverInvitation, {
      previous: previousRow,
      actorUserId: options.author.userId,
      action: `${options.auditAction}_failed`,
      outcome: "revoked_without_replacement",
      targetEmail: options.email,
      targetRoleSlug: options.roleSlug,
    });
    return { outcome: "revoked_without_replacement" };
  }

  // 4. Retire the old row, register the replacement, and audit it together.
  await ctx.runMutation(internal.invitationsInternal.recoverInvitation, {
    previous: previousRow,
    issued: {
      workosInvitationId: issued.id,
      email: options.email,
      organizationId: issued.organizationId,
      roleId: options.roleId,
      roleSlug: options.roleSlug,
      status: issued.status,
      createdAt: Date.now(),
      expiresAt: issued.expiresAt,
    },
    actorUserId: options.author.userId,
    action: options.auditAction,
    outcome: "replacement_issued",
    targetEmail: options.email,
    targetRoleSlug: options.roleSlug,
  });

  return { outcome: "issued", workosInvitationId: issued.id };
}

/**
 * Invite a user into the platform organization.
 *
 * The invitation carries the organization + role, so acceptance auto-joins the
 * account to the "MylesNet Platform" org with the selected role.
 */
export const sendInvitation = action({
  args: {
    email: v.string(),
    roleId: v.id("roles"),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const author = await ctx.runQuery(internal.invitationsInternal.getInvitationAuthor, {});
    const email = normalizeInvitationEmail(args.email);
    if (!email) throw new Error("Enter a valid email address.");
    if (author.workosUserId === null) throw new Error("Your identity has not been synchronized.");

    const role = await ctx.runQuery(internal.invitationsInternal.getRoleById, { roleId: args.roleId });
    if (!role) throw new Error("Role not found.");
    if (role.slug === "platform_owner") throw new Error("The owner role is claimed via bootstrap, not an invitation.");
    if (!isInvitableRole(role)) {
      throw new Error("This role is not synced to WorkOS yet; run the test sync in the Roles tab.");
    }

    const expiresInDays = resolveInvitationExpiryDays(args.expiresInDays);
    const workosSlug = role.workosRoleSlug ?? workosSlugForRole(role);

    const invitation = await createWorkosInvitation(
      email,
      platformOrganizationIdForRoleSync(),
      workosSlug,
      expiresInDays,
    );

    await ctx.runMutation(internal.invitationsInternal.applyInvitation, {
      workosInvitationId: invitation.id,
      email,
      organizationId: invitation.organization_id ?? platformOrganizationIdForRoleSync(),
      roleId: args.roleId,
      roleSlug: workosSlug,
      status: invitation.state === "accepted" ? "accepted" : "pending",
      invitedByUserId: author.userId,
      createdAt: Date.now(),
      expiresAt: invitation.expires_at ? Date.parse(invitation.expires_at) || undefined : undefined,
    });

    await ctx.runMutation(internal.invitationsInternal.logInvitationAudit, {
      action: "invitation.send",
      workosInvitationId: invitation.id,
      email,
      roleSlug: workosSlug,
      actorUserId: author.userId,
    });

    return invitation.id;
  },
});

export const listInvitations = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "invitations:manage");
    // Tenant and network invitations share this table through the WorkOS
    // webhook, so the panel must know which rows belong to the platform.
    const platformOrganizationId = process.env.MYLESNET_PLATFORM_ORG_ID ?? null;
    const rows = await ctx.db.query("invitations").order("desc").take(100);
    const roles = await ctx.db.query("roles").collect();
    const roleById = new Map(roles.map((role) => [role._id, role]));
    return rows.map((invitation) => ({
      _id: invitation._id,
      workosInvitationId: invitation.workosInvitationId,
      email: invitation.email,
      roleId: invitation.roleId,
      roleName: (invitation.roleId && roleById.get(invitation.roleId)?.name) ?? null,
      roleSlug: invitation.roleSlug ?? null,
      status: invitation.status,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
      acceptedAt: invitation.acceptedAt,
      isPlatform:
        platformOrganizationId !== null && invitation.organizationId === platformOrganizationId,
    }));
  },
});

export const revokeInvitation = action({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const author = (await ctx.runQuery(internal.invitationsInternal.getInvitationAuthor, {})) as InvitationAuthor;
    const invitation = (await ctx.runQuery(internal.invitationsInternal.getInvitationById, { invitationId: args.invitationId })) as Doc<"invitations"> | null;
    const decision = decideInvitationRecovery(
      invitation ? { status: invitation.status, organizationId: invitation.organizationId } : null,
      platformOrganizationIdForRoleSync(),
    );
    if (!decision.allowed) throw new Error(invitationRecoveryErrorMessage(decision.reason));
    if (!invitation) throw new Error("Invitation not found.");

    await revokeWorkosInvitation(invitation.workosInvitationId);
    await ctx.runMutation(internal.invitationsInternal.applyInvitation, {
      workosInvitationId: invitation.workosInvitationId,
      email: invitation.email,
      organizationId: invitation.organizationId,
      roleId: invitation.roleId,
      roleSlug: invitation.roleSlug,
      status: "revoked",
      invitedByUserId: author.userId,
      createdAt: invitation.createdAt,
      expiresAt: invitation.expiresAt,
    });
    await ctx.runMutation(internal.invitationsInternal.logInvitationAudit, {
      action: "invitation.revoke",
      workosInvitationId: invitation.workosInvitationId,
      email: invitation.email,
      roleSlug: invitation.roleSlug,
      actorUserId: author.userId,
    });
    return invitation.workosInvitationId;
  },
});

/**
 * Re-send a pending invitation under a fresh link with the same email and role.
 *
 * Use this when the original message was lost or the link expired. The previous
 * WorkOS invitation is revoked so only one link is ever live.
 */
export const resendInvitation = action({
  args: {
    invitationId: v.id("invitations"),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<InvitationRecoveryOutcome> => {
    const author = (await ctx.runQuery(internal.invitationsInternal.getInvitationAuthor, {})) as InvitationAuthor;
    const invitation = (await ctx.runQuery(internal.invitationsInternal.getInvitationById, { invitationId: args.invitationId })) as Doc<"invitations"> | null;
    const decision = decideInvitationRecovery(
      invitation ? { status: invitation.status, organizationId: invitation.organizationId } : null,
      platformOrganizationIdForRoleSync(),
    );
    if (!decision.allowed) throw new Error(invitationRecoveryErrorMessage(decision.reason));
    if (!invitation) throw new Error("Invitation not found.");

    const email = normalizeInvitationEmail(invitation.email);
    if (!email) throw new Error("The invitation email is not valid; use Replace to enter a correct address.");
    if (!invitation.roleId) throw new Error("The invitation has no role; use Replace to choose one.");

    const role = await ctx.runQuery(internal.invitationsInternal.getRoleById, { roleId: invitation.roleId });
    if (!role || !isInvitableRole(role)) {
      throw new Error("The invitation role is no longer available; use Replace to choose another role.");
    }

    return reissueInvitation(ctx, {
      author,
      previous: invitation,
      email,
      roleId: invitation.roleId,
      roleSlug: role.workosRoleSlug ?? workosSlugForRole(role),
      expiresInDays: resolveInvitationExpiryDays(args.expiresInDays),
      auditAction: "invitation.resend",
    });
  },
});

/**
 * Replace a pending invitation's email, role, or lifetime.
 *
 * This reuses the resend machinery: the old WorkOS invitation is revoked and a
 * new one is issued for the corrected details, with both steps audited.
 */
export const replaceInvitation = action({
  args: {
    invitationId: v.id("invitations"),
    email: v.optional(v.string()),
    roleId: v.optional(v.id("roles")),
    expiresInDays: v.optional(v.number()),
  },
  handler: async (ctx, args): Promise<InvitationRecoveryOutcome> => {
    const author = (await ctx.runQuery(internal.invitationsInternal.getInvitationAuthor, {})) as InvitationAuthor;
    const invitation = (await ctx.runQuery(internal.invitationsInternal.getInvitationById, { invitationId: args.invitationId })) as Doc<"invitations"> | null;
    const decision = decideInvitationRecovery(
      invitation ? { status: invitation.status, organizationId: invitation.organizationId } : null,
      platformOrganizationIdForRoleSync(),
    );
    if (!decision.allowed) throw new Error(invitationRecoveryErrorMessage(decision.reason));
    if (!invitation) throw new Error("Invitation not found.");

    const email = normalizeInvitationEmail(args.email ?? invitation.email);
    if (!email) throw new Error("Enter a valid email address.");

    const roleId = args.roleId ?? invitation.roleId;
    if (!roleId) throw new Error("Choose a role for the invitee.");
    const role = await ctx.runQuery(internal.invitationsInternal.getRoleById, { roleId });
    if (!role || !isInvitableRole(role)) throw new Error("That role cannot be used for an invitation.");

    return reissueInvitation(ctx, {
      author,
      previous: invitation,
      email,
      roleId,
      roleSlug: role.workosRoleSlug ?? workosSlugForRole(role),
      expiresInDays: resolveInvitationExpiryDays(args.expiresInDays),
      auditAction: "invitation.replace",
    });
  },
});
