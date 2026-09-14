import { v } from "convex/values";
import { internalAction, internalMutation, internalQuery } from "./_generated/server";
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

function pickRoleSlug(record: EventPayload): string | null {
  const direct = pickString(record, ["role_slug", "roleSlug"]);
  if (direct) return direct;
  const role = asRecord(record.role);
  const fromRole = role ? pickString(role, ["slug"]) : null;
  if (fromRole) return fromRole;
  const roles = record.roles;
  if (!Array.isArray(roles)) return null;
  for (const candidate of roles) {
    const slug = asRecord(candidate) ? pickString(asRecord(candidate)!, ["slug"]) : null;
    if (slug) return slug;
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

export const getQueuedWorkosEvent = internalQuery({
  args: { deliveryId: v.id("workosWebhookEvents") },
  handler: async (ctx, args) => ctx.db.get(args.deliveryId),
});

/** Persist before scheduling. Re-deliveries are harmlessly deduplicated. */
export const enqueueWorkosEvent = internalMutation({
  args: { eventId: v.string(), event: v.string(), data: v.any() },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("workosWebhookEvents")
      .withIndex("by_eventId", (q) => q.eq("eventId", args.eventId))
      .first();
    if (existing) return { deliveryId: existing._id, duplicate: true };
    const deliveryId = await ctx.db.insert("workosWebhookEvents", {
      eventId: args.eventId,
      eventType: args.event,
      data: args.data,
      status: "received",
      attempts: 0,
      receivedAt: Date.now(),
    });
    await ctx.scheduler.runAfter(0, internal.workosWebhook.processQueuedWorkosEvent, { deliveryId });
    return { deliveryId, duplicate: false };
  },
});

export const markQueuedWorkosEvent = internalMutation({
  args: {
    deliveryId: v.id("workosWebhookEvents"),
    status: v.union(v.literal("completed"), v.literal("retry"), v.literal("quarantined")),
    reason: v.optional(v.string()),
    nextAttemptAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const delivery = await ctx.db.get(args.deliveryId);
    if (!delivery) return;
    await ctx.db.patch(args.deliveryId, {
      status: args.status,
      attempts: delivery.attempts + 1,
      processedAt: args.status === "completed" || args.status === "quarantined" ? Date.now() : undefined,
      nextAttemptAt: args.nextAttemptAt,
      reason: args.reason,
    });
  },
});

async function organizationIsKnown(ctx: { db: { query: (table: "tenants") => any } }, organizationId: string): Promise<boolean> {
  if (organizationId === process.env.MYLESNET_PLATFORM_ORG_ID || organizationId === process.env.MYLESNET_NETWORK_ORG_ID) return true;
  return !!(await ctx.db.query("tenants")
    .withIndex("by_workosOrganizationId", (q: any) => q.eq("workosOrganizationId", organizationId))
    .first());
}

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
      const roleSlug = pickRoleSlug(payload);
      const statusValue = pickString(payload, ["status"]);
      const status = statusValue === "inactive" ? "inactive" : statusValue === "pending" ? "pending" : "active";
      const email = pickString(payload, ["user_email", "email"]);
      const name = pickString(payload, ["user_name", "name"]);
      if (!membershipId || !organizationId || !workosUserId) {
        return { handled: false, reason: "malformed_membership" };
      }
      if (!(await organizationIsKnown(ctx, organizationId))) {
        return { handled: false, reason: "unknown_organization" };
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
        // A deleted tenant-org membership must revoke the local tenant grant
        // too; otherwise a WorkOS removal leaves a live Convex authorization.
        const tenant = await ctx.db
          .query("tenants")
          .withIndex("by_workosOrganizationId", (q) => q.eq("workosOrganizationId", membership.organizationId))
          .first();
        if (tenant && user) {
          const tenantMembership = await ctx.db
            .query("tenantMemberships")
            .withIndex("by_user_tenant", (q) => q.eq("userId", user._id).eq("tenantId", tenant._id))
            .first();
          if (tenantMembership) {
            await ctx.db.patch(tenantMembership._id, { status: "revoked", revokedAt: Date.now() });
          }
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
      if (organizationId && !(await organizationIsKnown(ctx, organizationId))) {
        return { handled: false, reason: "unknown_organization" };
      }
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

/** Run after the HTTP handler has durably acknowledged the WorkOS delivery. */
export const processQueuedWorkosEvent = internalAction({
  args: { deliveryId: v.id("workosWebhookEvents") },
  handler: async (ctx, args) => {
    const delivery = await ctx.runQuery(internal.workosWebhook.getQueuedWorkosEvent, args);
    if (!delivery || delivery.status === "completed" || delivery.status === "quarantined") return;
    try {
      const result = await ctx.runMutation(internal.workosWebhook.processWorkosEvent, {
        event: delivery.eventType,
        data: delivery.data,
      }) as { handled?: boolean; reason?: string };
      if (result.handled) {
        await ctx.runMutation(internal.workosWebhook.markQueuedWorkosEvent, { deliveryId: args.deliveryId, status: "completed" });
      } else {
        await ctx.runMutation(internal.workosWebhook.markQueuedWorkosEvent, {
          deliveryId: args.deliveryId,
          status: "quarantined",
          reason: result.reason ?? "unhandled_event",
        });
      }
    } catch (error) {
      const attempts = delivery.attempts + 1;
      const reason = error instanceof Error ? error.message.slice(0, 240) : "processing_failed";
      if (attempts >= 5) {
        await ctx.runMutation(internal.workosWebhook.markQueuedWorkosEvent, { deliveryId: args.deliveryId, status: "quarantined", reason });
        return;
      }
      const delayMs = Math.min(60_000, 1_000 * 2 ** attempts);
      await ctx.runMutation(internal.workosWebhook.markQueuedWorkosEvent, {
        deliveryId: args.deliveryId,
        status: "retry",
        reason,
        nextAttemptAt: Date.now() + delayMs,
      });
      await ctx.scheduler.runAfter(delayMs, internal.workosWebhook.processQueuedWorkosEvent, args);
    }
  },
});
