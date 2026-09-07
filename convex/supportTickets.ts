import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMarketAccess, requirePermission } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

export const listSupportTickets = query({
  args: {
    ticketStatus: v.optional(
      v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("waiting_on_customer"),
        v.literal("resolved"),
        v.literal("closed")
      )
    ),
    marketId: v.optional(v.id("markets")),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "tickets:read");
    if (args.marketId) await requireMarketAccess(ctx, args.marketId, "viewer");
    let tickets = await ctx.db.query("supportTickets").collect();

    if (args.ticketStatus) {
      tickets = tickets.filter((t) => t.ticketStatus === args.ticketStatus);
    }
    if (args.marketId) {
      tickets = tickets.filter((t) => t.marketId === args.marketId);
    }
    if (args.agentId) {
      tickets = tickets.filter((t) => t.agentId === args.agentId);
    }
    return tickets.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const getSupportTicket = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "tickets:read");
    const ticket = await ctx.db.get(args.ticketId);
    if (ticket?.marketId) await requireMarketAccess(ctx, ticket.marketId, "viewer");
    return ticket;
  },
});

export const createSupportTicket = mutation({
  args: {
    subject: v.string(),
    description: v.string(),
    priority: v.union(
      v.literal("low"),
      v.literal("medium"),
      v.literal("high"),
      v.literal("urgent")
    ),
    marketId: v.optional(v.id("markets")),
    agentId: v.optional(v.id("agents")),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "tickets:manage");
    if (args.marketId) await requireMarketAccess(ctx, args.marketId, "operator");
    const now = Date.now();
    const ticketId = await ctx.db.insert("supportTickets", {
      subject: args.subject,
      description: args.description,
      ticketStatus: "open",
      priority: args.priority,
      marketId: args.marketId,
      agentId: args.agentId,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "supportTicket.create",
      entityTable: "supportTickets",
      entityId: ticketId,
      changedBy: user._id,
      after: { subject: args.subject, priority: args.priority },
    });
    return ticketId;
  },
});

export const updateSupportTicket = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    ticketStatus: v.optional(
      v.union(
        v.literal("open"),
        v.literal("in_progress"),
        v.literal("waiting_on_customer"),
        v.literal("resolved"),
        v.literal("closed")
      )
    ),
    priority: v.optional(
      v.union(
        v.literal("low"),
        v.literal("medium"),
        v.literal("high"),
        v.literal("urgent")
      )
    ),
    description: v.optional(v.string()),
    assignedTo: v.optional(v.id("users")),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "tickets:manage");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.marketId) await requireMarketAccess(ctx, ticket.marketId, "operator");

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.ticketStatus !== undefined) {
      patch.ticketStatus = args.ticketStatus;
      if (args.ticketStatus === "resolved") patch.resolvedAt = Date.now();
      if (args.ticketStatus === "closed") patch.closedAt = Date.now();
    }
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.description !== undefined) patch.description = args.description;
    if (args.assignedTo !== undefined) patch.assignedTo = args.assignedTo;

    await ctx.db.patch(args.ticketId, patch);
    await logAudit(ctx, {
      action: "supportTicket.update",
      entityTable: "supportTickets",
      entityId: args.ticketId,
      changedBy: user._id,
      before: { ticketStatus: ticket.ticketStatus, priority: ticket.priority },
      after: patch,
    });
  },
});

export const softDeleteTicket = mutation({
  args: {
    ticketId: v.id("supportTickets"),
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "tickets:manage");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.marketId) await requireMarketAccess(ctx, ticket.marketId, "operator");

    await ctx.db.patch(args.ticketId, {
      deletedAt: Date.now(),
      deletedBy: user._id,
      deleteReason: args.reason,
    });
    await logAudit(ctx, {
      action: "supportTicket.softDelete",
      entityTable: "supportTickets",
      entityId: args.ticketId,
      changedBy: user._id,
      after: { reason: args.reason },
    });
  },
});

export const restoreTicket = mutation({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "tickets:manage");
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket) throw new Error("Ticket not found");
    if (ticket.marketId) await requireMarketAccess(ctx, ticket.marketId, "operator");

    await ctx.db.patch(args.ticketId, {
      deletedAt: undefined,
      deletedBy: undefined,
      deleteReason: undefined,
      restoredAt: Date.now(),
      restoredBy: user._id,
    });
    await logAudit(ctx, {
      action: "supportTicket.restore",
      entityTable: "supportTickets",
      entityId: args.ticketId,
      changedBy: user._id,
    });
  },
});
