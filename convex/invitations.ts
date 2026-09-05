import { v } from "convex/values";
import { action, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePermission } from "./lib/auth";
import { workosSlugForRole } from "./lib/permissions";
import { platformOrganizationIdForRoleSync, createWorkosInvitation, revokeWorkosInvitation } from "./workos";

const INVITATION_EXPIRY_DAYS = 7;

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
    const author = await ctx.runQuery(internal.invitationsInternal.getInvitationAuthor, { permission: "invitations:manage" });
    const email = args.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Enter a valid email address.");
    if (author.workosUserId === null) throw new Error("Your identity has not been synchronized.");

    const role = await ctx.runQuery(internal.invitationsInternal.getRoleById, { roleId: args.roleId });
    if (!role) throw new Error("Role not found.");
    if (role.slug === "platform_owner") throw new Error("The owner role is claimed via bootstrap, not an invitation.");
    if (!role.workosRoleSlug && !role.isSystem) {
      throw new Error("This role is not synced to WorkOS yet; run the test sync in the Roles tab.");
    }

    const expiresInDays = Math.min(30, Math.max(1, args.expiresInDays ?? INVITATION_EXPIRY_DAYS));
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
    }));
  },
});

export const revokeInvitation = action({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => {
    const author = (await ctx.runQuery(internal.invitationsInternal.getInvitationAuthor, { permission: "invitations:manage" })) as {
      userId: Id<"users">;
      workosUserId: string | null;
      primaryRoleName: string | null;
    };
    const invitation = (await ctx.runQuery(internal.invitationsInternal.getInvitationById, { invitationId: args.invitationId })) as Doc<"invitations"> | null;
    if (!invitation) throw new Error("Invitation not found.");
    if (invitation.status !== "pending") throw new Error("Only pending invitations can be revoked.");

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