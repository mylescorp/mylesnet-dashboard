import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { requirePlatformAdmin, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

const INVITATION_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function generateToken(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let token = "";
  for (let i = 0; i < 48; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

export const listInvitations = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    return (await ctx.db.query("agentInvitations").collect()).sort(
      (a, b) => b.createdAt - a.createdAt
    );
  },
});

export const getInvitationByToken = query({
  args: { token: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("agentInvitations")
      .withIndex("by_token", (q) => q.eq("invitationToken", args.token))
      .first();
  },
});

export const createInvitation = mutation({
  args: {
    email: v.string(),
    phone: v.string(),
    name: v.string(),
    targetMarketId: v.optional(v.id("markets")),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const now = Date.now();

    const existing = await ctx.db
      .query("agentInvitations")
      .withIndex("by_email", (q) => q.eq("email", args.email.toLowerCase()))
      .filter((q) => q.gt(q.field("expiresAt"), now))
      .first();

    if (existing) {
      throw new Error("An active invitation already exists for this email");
    }

    const token = generateToken();
    const invitationId = await ctx.db.insert("agentInvitations", {
      email: args.email.toLowerCase(),
      phone: args.phone,
      name: args.name,
      targetMarketId: args.targetMarketId,
      invitedBy: user._id,
      createdAt: now,
      expiresAt: now + INVITATION_EXPIRY_MS,
      invitationToken: token,
    });

    await logAudit(ctx, {
      action: "agentInvitation.create",
      entityTable: "agentInvitations",
      entityId: invitationId,
      changedBy: user._id,
      after: { email: args.email, name: args.name },
    });

    return { invitationId, token, expiresAt: now + INVITATION_EXPIRY_MS };
  },
});

export const markInvitationAccepted = internalMutation({
  args: { invitationId: v.id("agentInvitations") },
  handler: async (ctx, args) => {
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new Error("Invitation not found");
    if (invitation.acceptedAt) throw new Error("Invitation already accepted");
    if (Date.now() > invitation.expiresAt) throw new Error("Invitation expired");

    await ctx.db.patch(args.invitationId, {
      acceptedAt: Date.now(),
    });
  },
});

export const revokeInvitation = mutation({
  args: { invitationId: v.id("agentInvitations") },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const invitation = await ctx.db.get(args.invitationId);
    if (!invitation) throw new Error("Invitation not found");

    await ctx.db.delete(args.invitationId);
    await logAudit(ctx, {
      action: "agentInvitation.revoke",
      entityTable: "agentInvitations",
      entityId: args.invitationId,
      changedBy: user._id,
    });
  },
});
