import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformAdmin, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const listMarketProspects = query({
  args: {
    status: v.optional(
      v.union(
        v.literal("prospect"),
        v.literal("negotiating"),
        v.literal("provisioning"),
        v.literal("live")
      )
    ),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    if (args.status) {
      return await ctx.db
        .query("marketProspects")
        .withIndex("by_status", (q) => q.eq("pipelineStatus", args.status!))
        .collect();
    }
    return await ctx.db.query("marketProspects").collect();
  },
});

export const getMarketProspect = query({
  args: { prospectId: v.id("marketProspects") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db.get(args.prospectId);
  },
});

export const createMarketProspect = mutation({
  args: {
    name: v.string(),
    country: v.string(),
    currency: v.union(v.literal("UGX"), v.literal("KSH")),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const now = Date.now();
    const prospectId = await ctx.db.insert("marketProspects", {
      name: args.name,
      country: args.country,
      currency: args.currency,
      pipelineStatus: "prospect",
      contactName: args.contactName,
      contactPhone: args.contactPhone,
      contactEmail: args.contactEmail,
      notes: args.notes,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "marketProspect.create",
      entityTable: "marketProspects",
      entityId: prospectId,
      changedBy: user._id,
      after: { name: args.name, country: args.country },
    });
    return prospectId;
  },
});

export const updateMarketProspect = mutation({
  args: {
    prospectId: v.id("marketProspects"),
    pipelineStatus: v.optional(
      v.union(
        v.literal("prospect"),
        v.literal("negotiating"),
        v.literal("provisioning"),
        v.literal("live")
      )
    ),
    name: v.optional(v.string()),
    contactName: v.optional(v.string()),
    contactPhone: v.optional(v.string()),
    contactEmail: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const existing = await ctx.db.get(args.prospectId);
    if (!existing) throw new Error("Prospect not found");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.pipelineStatus !== undefined) patch.pipelineStatus = args.pipelineStatus;
    if (args.name !== undefined) patch.name = args.name;
    if (args.contactName !== undefined) patch.contactName = args.contactName;
    if (args.contactPhone !== undefined) patch.contactPhone = args.contactPhone;
    if (args.contactEmail !== undefined) patch.contactEmail = args.contactEmail;
    if (args.notes !== undefined) patch.notes = args.notes;

    await ctx.db.patch(args.prospectId, patch);
    await logAudit(ctx, {
      action: "marketProspect.update",
      entityTable: "marketProspects",
      entityId: args.prospectId,
      changedBy: user._id,
      before: { pipelineStatus: existing.pipelineStatus },
      after: patch,
    });
  },
});

/**
 * Convert a prospect to a live market. Creates the market record, links it
 * back to the prospect, and moves the prospect to "live" status.
 */
export const convertProspectToMarket = mutation({
  args: {
    prospectId: v.id("marketProspects"),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) throw new Error("Prospect not found");
    if (prospect.pipelineStatus === "live") throw new Error("Prospect already converted");
    if (prospect.convertedMarketId) throw new Error("Prospect already has a linked market");

    const now = Date.now();
    const marketId = await ctx.db.insert("markets", {
      name: prospect.name,
      country: prospect.country,
      currency: prospect.currency,
      lifecycleStatus: "planned",
      status: "active",
      createdAt: now,
      updatedAt: now,
    });

    await ctx.db.patch(args.prospectId, {
      pipelineStatus: "live",
      convertedMarketId: marketId,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "marketProspect.convertToMarket",
      entityTable: "marketProspects",
      entityId: args.prospectId,
      changedBy: user._id,
      after: { marketId, prospectStatus: "live" },
    });

    return { marketId };
  },
});

export const softDeleteProspect = mutation({
  args: {
    prospectId: v.id("marketProspects"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) throw new Error("Prospect not found");

    await ctx.db.patch(args.prospectId, {
      deletedAt: Date.now(),
      deletedBy: user._id,
      deleteReason: args.reason,
    });
    await logAudit(ctx, {
      action: "marketProspect.softDelete",
      entityTable: "marketProspects",
      entityId: args.prospectId,
      changedBy: user._id,
      after: { reason: args.reason },
    });
  },
});

export const restoreProspect = mutation({
  args: { prospectId: v.id("marketProspects") },
  handler: async (ctx, args) => {
    const user = await requirePlatformAdmin(ctx);
    const prospect = await ctx.db.get(args.prospectId);
    if (!prospect) throw new Error("Prospect not found");

    await ctx.db.patch(args.prospectId, {
      deletedAt: undefined,
      deletedBy: undefined,
      deleteReason: undefined,
      restoredAt: Date.now(),
      restoredBy: user._id,
    });
    await logAudit(ctx, {
      action: "marketProspect.restore",
      entityTable: "marketProspects",
      entityId: args.prospectId,
      changedBy: user._id,
    });
  },
});
