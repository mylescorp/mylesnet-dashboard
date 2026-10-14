import { v } from "convex/values";
import { internalMutation, internalQuery, type MutationCtx } from "./_generated/server";
import { requirePlatformSubRole, resolveRoles } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import type { Id } from "./_generated/dataModel";

/**
 * Internal invitation helpers used by the `invitations` actions and the
 * WorkOS webhook dispatcher. Kept out of `invitations.ts` so its public
 * actions never reference their own module through `internal` (avoids
 * cyclic type inference).
 */

/** Who is the caller (for attribution) and what is their highest role? */
export const getInvitationAuthor = internalQuery({
  args: {},
  handler: async (ctx) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const roles = await resolveRoles(ctx, user);
    const primary = roles.slice().sort((left, right) => right.rank - left.rank)[0];
    return {
      userId: user._id,
      workosUserId: user.workosUserId ?? null,
      primaryRoleName: primary?.name ?? null,
    };
  },
});

export const getInvitationById = internalQuery({
  args: { invitationId: v.id("invitations") },
  handler: async (ctx, args) => ctx.db.get(args.invitationId),
});

export const getRoleById = internalQuery({
  args: { roleId: v.id("roles") },
  handler: async (ctx, args) => {
    const row = await ctx.db.get(args.roleId);
    return row && row.deletedAt === undefined ? row : null;
  },
});

type InvitationRowInput = {
  workosInvitationId: string;
  email: string;
  organizationId: string;
  roleId?: Id<"roles">;
  roleSlug?: string;
  status: "pending" | "accepted" | "revoked";
  invitedByUserId?: Id<"users">;
  createdAt: number;
  expiresAt?: number;
  acceptedAt?: number;
};

/** Idempotent upsert of a WorkOS invitation into the local registry. */
async function upsertInvitationRow(ctx: MutationCtx, args: InvitationRowInput) {
  const existing = await ctx.db
    .query("invitations")
    .withIndex("by_workosId", (q) => q.eq("workosInvitationId", args.workosInvitationId))
    .first();
  if (existing) {
    await ctx.db.patch(existing._id, {
      status: args.status,
      roleId: args.roleId,
      roleSlug: args.roleSlug,
      expiresAt: args.expiresAt,
      acceptedAt: args.acceptedAt ?? existing.acceptedAt,
      revokedAt: args.status === "revoked" ? Date.now() : existing.revokedAt,
    });
    return existing._id;
  }
  return ctx.db.insert("invitations", {
    workosInvitationId: args.workosInvitationId,
    email: args.email,
    roleId: args.roleId,
    roleSlug: args.roleSlug,
    organizationId: args.organizationId,
    status: args.status,
    invitedByUserId: args.invitedByUserId,
    createdAt: args.createdAt,
    expiresAt: args.expiresAt,
    acceptedAt: args.acceptedAt,
  });
}

type InvitationAuditInput = {
  action: string;
  workosInvitationId: string;
  email: string;
  roleSlug?: string;
  actorUserId: Id<"users">;
  previousWorkosInvitationId?: string;
  previousEmail?: string;
  previousRoleSlug?: string;
  outcome?: string;
};

/**
 * Append the audit entry for an invitation transition. Callers run this inside
 * the same mutation as the local write so neither can land without the other.
 */
async function writeInvitationAudit(ctx: MutationCtx, args: InvitationAuditInput) {
  const hasPrevious =
    args.previousWorkosInvitationId !== undefined ||
    args.previousEmail !== undefined ||
    args.previousRoleSlug !== undefined;
  await logAudit(ctx, {
    action: args.action,
    entityTable: "invitations",
    entityId: args.workosInvitationId,
    changedBy: args.actorUserId,
    tenantId: null,
    before: hasPrevious
      ? {
          workosInvitationId: args.previousWorkosInvitationId ?? null,
          email: args.previousEmail ?? null,
          roleSlug: args.previousRoleSlug ?? null,
        }
      : undefined,
    after: {
      email: args.email,
      roleSlug: args.roleSlug,
      ...(args.outcome !== undefined ? { outcome: args.outcome } : {}),
    },
  });
}

/**
 * Append a standalone invitation audit entry.
 *
 * Used for transitions whose local write is already recorded (send, revoke) and
 * for the pre-flight intent entry that documents a recovery attempt before the
 * first WorkOS call. Recovery completions use `recoverInvitation` so the local
 * write and its audit land in one transaction.
 */
export const logInvitationAudit = internalMutation({
  args: {
    action: v.string(),
    workosInvitationId: v.string(),
    email: v.string(),
    roleSlug: v.optional(v.string()),
    actorUserId: v.id("users"),
    previousWorkosInvitationId: v.optional(v.string()),
    previousEmail: v.optional(v.string()),
    previousRoleSlug: v.optional(v.string()),
    outcome: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await writeInvitationAudit(ctx, args);
  },
});

/** Idempotent upsert used by the WorkOS webhook dispatcher. */
export const applyInvitation = internalMutation({
  args: {
    workosInvitationId: v.string(),
    email: v.string(),
    organizationId: v.string(),
    roleId: v.optional(v.id("roles")),
    roleSlug: v.optional(v.string()),
    status: v.union(v.literal("pending"), v.literal("accepted"), v.literal("revoked")),
    invitedByUserId: v.optional(v.id("users")),
    createdAt: v.number(),
    expiresAt: v.optional(v.number()),
    acceptedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => upsertInvitationRow(ctx, args),
});

const previousInvitationValidator = v.object({
  workosInvitationId: v.string(),
  email: v.string(),
  organizationId: v.string(),
  roleId: v.optional(v.id("roles")),
  roleSlug: v.optional(v.string()),
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
});

const issuedInvitationValidator = v.object({
  workosInvitationId: v.string(),
  email: v.string(),
  organizationId: v.string(),
  roleId: v.optional(v.id("roles")),
  roleSlug: v.optional(v.string()),
  status: v.union(v.literal("pending"), v.literal("accepted")),
  createdAt: v.number(),
  expiresAt: v.optional(v.number()),
  acceptedAt: v.optional(v.number()),
});

/**
 * Retire a recovered invitation and, when the replacement was issued, register
 * it in the same transaction as the audit entry.
 *
 * Recovery spans a WorkOS revoke, a WorkOS create, and local writes. Keeping the
 * retired row, the replacement row, and the audit entry in one transaction
 * means a failure cannot leave a local change or a recovery step unrecorded.
 * `action` is the operation name; `outcome` distinguishes a completed
 * replacement from a revocation that could not be replaced.
 */
export const recoverInvitation = internalMutation({
  args: {
    previous: previousInvitationValidator,
    issued: v.optional(issuedInvitationValidator),
    actorUserId: v.id("users"),
    action: v.string(),
    targetEmail: v.string(),
    targetRoleSlug: v.optional(v.string()),
    outcome: v.string(),
  },
  handler: async (ctx, args) => {
    await upsertInvitationRow(ctx, {
      ...args.previous,
      status: "revoked",
      invitedByUserId: args.actorUserId,
    });
    if (args.issued) {
      await upsertInvitationRow(ctx, {
        ...args.issued,
        invitedByUserId: args.actorUserId,
      });
    }
    await writeInvitationAudit(ctx, {
      action: args.action,
      workosInvitationId: args.issued?.workosInvitationId ?? args.previous.workosInvitationId,
      email: args.issued?.email ?? args.targetEmail,
      roleSlug: args.issued?.roleSlug ?? args.targetRoleSlug,
      actorUserId: args.actorUserId,
      previousWorkosInvitationId: args.previous.workosInvitationId,
      previousEmail: args.previous.email,
      previousRoleSlug: args.previous.roleSlug,
      outcome: args.outcome,
    });
  },
});
