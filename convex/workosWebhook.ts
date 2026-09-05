import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";

type EventPayload = Record<string, unknown>;

function asRecord(value: unknown): EventPayload | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as EventPayload)
    : null;
}

function pickString(record: EventPayload, keys: string[]): string | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return null;
}

function pickNumber(record: EventPayload, keys: string[]): number | null {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function parseWosTimestamp(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value) {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

export const logWorkosDelivery = internalMutation({
  args: {
    eventType: v.string(),
    signatureValid: v.boolean(),
    processed: v.boolean(),
    errorMessage: v.optional(v.string()),
    rawBodyPreview: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("webhookDeliveryLog", {
      receivedAt: Date.now(),
      eventType: `workos.${args.eventType}`,
      signatureValid: args.signatureValid,
      processed: args.processed,
      errorMessage: args.errorMessage,
      rawBodyPreview: args.rawBodyPreview,
    });
  },
});

export const processWorkosEvent = internalMutation({
  args: {
    event: v.string(),
    data: v.any(),
  },
  handler: async (ctx, args) => {
    const payload = asRecord(args.data);
    if (!payload) return { handled: false, reason: "empty_payload" };

    const id = pickString(payload, ["id"]);

    // --- User lifecycle --------------------------------------------------
    if (args.event === "user.created" || args.event === "user.updated") {
      const firstName = pickString(payload, ["first_name", "firstName"]);
      const lastName = pickString(payload, ["last_name", "lastName"]);
      const email = pickString(payload, ["email"]);
      const image = pickString(payload, ["profile_picture_url", "profilePictureUrl"]);
      if (!id) return { handled: false, reason: "missing_user_id" };
      await ctx.runMutation(internal.platformUsers.syncWorkosIdentity, {
        workosUserId: id,
        email: email ?? undefined,
        name: firstName && lastName ? `${firstName} ${lastName}` : firstName ?? undefined,
        image: image ?? undefined,
      });
      return { handled: true, event: args.event };
    }

    if (args.event === "user.deleted") {
      if (!id) return { handled: false, reason: "missing_user_id" };
      const user = await ctx.db
        .query("users")
        .withIndex("by_workosUserId", (q) => q.eq("workosUserId", id))
        .first();
      if (user) {
        await ctx.db.patch(user._id, { isActive: false, deactivatedAt: Date.now() });
      }
      return { handled: true, event: args.event };
    }

    // --- Organization membership -----------------------------------------
    if (args.event === "organization_membership.created" || args.event === "organization_membership.updated") {
      const membershipId = pickString(payload, ["id"]);
      const organizationId = pickString(payload, ["organization_id", "organizationId"]);
      const workosUserId = pickString(payload, ["user_id", "userId"]);
      const roleSlug = pickString(payload, ["role_slug", "roleSlug"]) ?? pickString(payload, ["role", "slug"]);
      const statusValue = pickString(payload, ["status"]);
      const status = statusValue === "inactive" ? "inactive" : statusValue === "pending" ? "pending" : "active";
      const email = pickString(payload, ["user_email", "email"]);
      const name = pickString(payload, ["user_name", "name"]);
      if (!membershipId || !organizationId || !workosUserId) {
        return { handled: false, reason: "malformed_membership" };
      }
      await ctx.runMutation(internal.platformUsers.recordOrganizationMembership, {
        workosMembershipId: membershipId,
        workosUserId,
        organizationId,
        roleSlug: roleSlug ?? undefined,
        status,
        email: email ?? undefined,
        name: name ?? undefined,
      });
      return { handled: true, event: args.event };
    }

    if (args.event === "organization_membership.deleted") {
      const membershipId = pickString(payload, ["id"]);
      if (!membershipId) return { handled: false, reason: "missing_membership_id" };
      const membership = await ctx.db
        .query("organizationMemberships")
        .withIndex("by_membership", (q) => q.eq("workosMembershipId", membershipId))
        .first();
      if (membership) {
        await ctx.db.patch(membership._id, { status: "inactive", syncedAt: Date.now() });
        const user = await ctx.db
          .query("users")
          .withIndex("by_workosUserId", (q) => q.eq("workosUserId", membership.workosUserId))
          .first();
        const platformOrgId = process.env.MYLESNET_PLATFORM_ORG_ID;
        if (user && platformOrgId && membership.organizationId === platformOrgId) {
          await ctx.db.patch(user._id, { isActive: false, deactivatedAt: Date.now() });
        }
      }
      return { handled: true, event: args.event };
    }

    // --- Invitations ------------------------------------------------------
    if (args.event === "invitation.created" || args.event === "invitation.accepted" || args.event === "invitation.revoked") {
      const invitationId = pickString(payload, ["id"]);
      const email = pickString(payload, ["email"]);
      const organizationId = pickString(payload, ["organization_id", "organizationId"]);
      const roleSlug = pickString(payload, ["role_slug", "roleSlug"]);
      if (!invitationId) return { handled: false, reason: "missing_invitation_id" };
      const existing = await ctx.db
        .query("invitations")
        .withIndex("by_workosId", (q) => q.eq("workosInvitationId", invitationId))
        .first();
      const expiresAt = parseWosTimestamp(pickString(payload, ["expires_at", "expiresAt"]) ?? pickNumber(payload, ["expires_at"]));
      await ctx.runMutation(internal.invitationsInternal.applyInvitation, {
        workosInvitationId: invitationId,
        email: existing?.email ?? email ?? "",
        organizationId: existing?.organizationId ?? organizationId ?? process.env.MYLESNET_PLATFORM_ORG_ID ?? "",
        roleId: existing?.roleId ?? undefined,
        roleSlug: existing?.roleSlug ?? roleSlug ?? undefined,
        status: args.event === "invitation.accepted" ? "accepted" : args.event === "invitation.revoked" ? "revoked" : "pending",
        invitedByUserId: existing?.invitedByUserId ?? undefined,
        createdAt: existing?.createdAt ?? Date.now(),
        expiresAt: expiresAt ?? existing?.expiresAt,
        acceptedAt: args.event === "invitation.accepted" ? Date.now() : existing?.acceptedAt,
      });
      return { handled: true, event: args.event };
    }

    // --- Role / session events (no state to mirror; acknowledged) ---------
    if (
      args.event.startsWith("role.") ||
      args.event.startsWith("organization_role.") ||
      args.event.startsWith("session.")
    ) {
      return { handled: true, event: args.event, acknowledged: true };
    }

    return { handled: false, reason: "unsupported_event" };
  },
});