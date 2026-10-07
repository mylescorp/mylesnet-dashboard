import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireMarketAccess, requirePermission, requirePlatformSubRole, resolveRoles } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

const platformTicketRoles = ["platform_super_admin", "platform_support", "platform_ops", "platform_finance"];
const ticketCategory = v.union(v.literal("network"), v.literal("billing"), v.literal("account"));

async function getPlatformTicketActor(ctx: Parameters<typeof requirePlatformSubRole>[0]) {
  const user = await requirePlatformSubRole(ctx, platformTicketRoles);
  const roles = await resolveRoles(ctx, user);
  const slugs = roles.map(role => role.slug);
  return {
    user,
    canManageAll: slugs.some(slug => ["platform_owner", "platform_admin", "platform_support"].includes(slug)),
    canReadNetwork: slugs.includes("ops_manager"),
    canReadBilling: slugs.includes("finance_manager"),
  };
}

function mayReadTicketCategory(actor: Awaited<ReturnType<typeof getPlatformTicketActor>>, category: "network" | "billing" | "account") {
  return actor.canManageAll || (category === "network" && actor.canReadNetwork) || (category === "billing" && actor.canReadBilling);
}

async function slaDeadlines(ctx: Parameters<typeof requirePlatformSubRole>[0], category: "network" | "billing" | "account", now: number) {
  const policy = await ctx.db.query("platformSlaPolicies").withIndex("by_category", q => q.eq("category", category)).first();
  const fallback = category === "network" ? { firstResponseMinutes: 15, resolutionMinutes: 240 } : category === "billing" ? { firstResponseMinutes: 60, resolutionMinutes: 2880 } : { firstResponseMinutes: 120, resolutionMinutes: 4320 };
  const sla = policy ?? fallback;
  return { firstResponseDueAt: now + sla.firstResponseMinutes * 60_000, resolutionDueAt: now + sla.resolutionMinutes * 60_000 };
}

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
    category: v.optional(v.union(v.literal("network"), v.literal("billing"), v.literal("account"))),
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
    const category = args.category ?? "account";
    const configuredSla = await ctx.db.query("platformSlaPolicies").withIndex("by_category", q => q.eq("category", category)).first();
    const fallbackSla = category === "network" ? { firstResponseMinutes: 15, resolutionMinutes: 240 } : category === "billing" ? { firstResponseMinutes: 60, resolutionMinutes: 2880 } : { firstResponseMinutes: 120, resolutionMinutes: 4320 };
    const sla = configuredSla ?? fallbackSla;
    const ticketId = await ctx.db.insert("supportTickets", {
      subject: args.subject,
      description: args.description,
      category,
      firstResponseDueAt: now + sla.firstResponseMinutes * 60_000,
      resolutionDueAt: now + sla.resolutionMinutes * 60_000,
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
      after: { subject: args.subject, priority: args.priority, category, firstResponseDueAt: now + sla.firstResponseMinutes * 60_000, resolutionDueAt: now + sla.resolutionMinutes * 60_000 },
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

/** Cross-tenant platform queue with sub-role-scoped billing/network reads. */
export const listPlatformTickets = query({
  args: { category: v.optional(ticketCategory), ticketStatus: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("waiting_on_customer"), v.literal("resolved"), v.literal("closed"))), includeDeleted: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const actor = await getPlatformTicketActor(ctx);
    let categoriesToRead: ("network" | "billing" | "account")[];
    if (args.category) categoriesToRead = mayReadTicketCategory(actor, args.category) ? [args.category] : [];
    else if (actor.canManageAll) categoriesToRead = ["network", "billing", "account"];
    else categoriesToRead = [actor.canReadNetwork ? "network" : null, actor.canReadBilling ? "billing" : null].filter((value): value is "network" | "billing" => value !== null);
    const perCategory = await Promise.all(categoriesToRead.map(category => ctx.db.query("supportTickets").withIndex("by_category", q => q.eq("category", category)).order("desc").take(200)));
    let rows = perCategory.flat().sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
    if (categoriesToRead.includes("account") && actor.canManageAll) {
      const legacyRows = await ctx.db.query("supportTickets").withIndex("by_category", q => q.eq("category", undefined)).order("desc").take(200);
      rows = [...rows, ...legacyRows].sort((a, b) => b.createdAt - a.createdAt).slice(0, 200);
    }
    rows = rows.filter(ticket => args.includeDeleted ? ticket.deletedAt !== undefined : ticket.deletedAt === undefined);
    if (args.ticketStatus) rows = rows.filter(ticket => ticket.ticketStatus === args.ticketStatus);
    return Promise.all(rows.map(async ticket => ({
      ...ticket,
      tenantName: ticket.tenantId ? (await ctx.db.get(ticket.tenantId))?.name ?? null : null,
    })));
  },
});

export const getPlatformTicket = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const actor = await getPlatformTicketActor(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.deletedAt !== undefined || !mayReadTicketCategory(actor, ticket.category ?? "account")) return null;
    return ticket;
  },
});

export const createPlatformTicket = mutation({
  args: { subject: v.string(), description: v.string(), category: ticketCategory, priority: v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent")), tenantId: v.optional(v.id("tenants")), marketId: v.optional(v.id("markets")) },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_support"]);
    const subject = args.subject.trim(); const description = args.description.trim();
    if (!subject || subject.length > 180) throw new Error("Ticket subject must be 1–180 characters");
    if (!description || description.length > 10_000) throw new Error("Ticket description must be 1–10,000 characters");
    let tenantId = args.tenantId;
    if (args.tenantId && !await ctx.db.get(args.tenantId)) throw new Error("Tenant not found");
    if (args.marketId) {
      const market = await ctx.db.get(args.marketId);
      if (!market || (tenantId && market.tenantId !== tenantId)) throw new Error("Market does not belong to the selected tenant");
      tenantId ??= market.tenantId;
    }
    const now = Date.now(); const deadlines = await slaDeadlines(ctx, args.category, now);
    const ticketId = await ctx.db.insert("supportTickets", {
      subject, description, category: args.category, ...deadlines,
      ticketStatus: "open", priority: args.priority, tenantId, marketId: args.marketId,
      createdBy: actor._id, createdAt: now, updatedAt: now,
    });
    await logAudit(ctx, { action: "platform.supportTicket.created", entityTable: "supportTickets", entityId: ticketId, changedBy: actor._id, after: { subject, category: args.category, priority: args.priority, tenantId: tenantId ?? null, ...deadlines } });
    return ticketId;
  },
});

export const updatePlatformTicket = mutation({
  args: { ticketId: v.id("supportTickets"), subject: v.optional(v.string()), description: v.optional(v.string()), category: v.optional(ticketCategory), priority: v.optional(v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"))), ticketStatus: v.optional(v.union(v.literal("open"), v.literal("in_progress"), v.literal("waiting_on_customer"), v.literal("resolved"), v.literal("closed"))), assignedTo: v.optional(v.id("users")) },
  handler: async (ctx, args) => {
    const actor = await getPlatformTicketActor(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.deletedAt !== undefined) throw new Error("Ticket not found");
    const category = ticket.category ?? "account";
    if (!mayReadTicketCategory(actor, category)) throw new Error("Unauthorized: ticket category is outside your support scope");
    const restricted = !actor.canManageAll;
    if (restricted && (args.subject !== undefined || args.category !== undefined || args.assignedTo !== undefined)) throw new Error("Your platform role can update status, priority, and description only");
    if (args.subject !== undefined && (!args.subject.trim() || args.subject.trim().length > 180)) throw new Error("Ticket subject must be 1–180 characters");
    if (args.description !== undefined && (!args.description.trim() || args.description.trim().length > 10_000)) throw new Error("Ticket description must be 1–10,000 characters");
    if (args.assignedTo !== undefined) {
      const assignee = await ctx.db.get(args.assignedTo);
      if (!assignee || assignee.deletedAt !== undefined || assignee.deactivatedAt !== undefined || assignee.isActive === false) {
        throw new Error("Assignee is not an active platform user");
      }
      const assigneeRoles = await resolveRoles(ctx, assignee);
      const assignedCategory = args.category ?? category;
      const eligible = assigneeRoles.some(role =>
        role.slug === "platform_super_admin" || role.slug === "platform_owner" || role.slug === "platform_admin" || role.slug === "platform_support" ||
        (assignedCategory === "network" && (role.slug === "ops_manager" || role.slug === "platform_ops")) ||
        (assignedCategory === "billing" && (role.slug === "finance_manager" || role.slug === "platform_finance"))
      );
      if (!eligible) throw new Error("Assignee does not have a platform role for this ticket category");
    }
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.subject !== undefined) patch.subject = args.subject.trim();
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.category !== undefined) patch.category = args.category;
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.ticketStatus !== undefined) {
      patch.ticketStatus = args.ticketStatus;
      if (args.ticketStatus === "resolved") patch.resolvedAt = Date.now();
      if (args.ticketStatus === "closed") patch.closedAt = Date.now();
    }
    if (args.assignedTo !== undefined) patch.assignedTo = args.assignedTo;
    await ctx.db.patch(ticket._id, patch);
    await logAudit(ctx, { action: "platform.supportTicket.updated", entityTable: "supportTickets", entityId: ticket._id, changedBy: actor.user._id, before: { subject: ticket.subject, description: ticket.description, category, priority: ticket.priority, ticketStatus: ticket.ticketStatus }, after: patch });
    return { updated: true };
  },
});

export const deletePlatformTicket = mutation({
  args: { ticketId: v.id("supportTickets"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_support"]);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.deletedAt !== undefined) throw new Error("Ticket not found");
    const reason = args.reason.trim();
    if (reason.length < 8 || reason.length > 500) throw new Error("Provide a deletion reason between 8 and 500 characters");
    const now = Date.now();
    await ctx.db.patch(ticket._id, { deletedAt: now, deletedBy: actor._id, deleteReason: reason, updatedAt: now });
    await logAudit(ctx, { action: "platform.supportTicket.deleted", entityTable: "supportTickets", entityId: ticket._id, changedBy: actor._id, before: { deletedAt: ticket.deletedAt ?? null }, after: { deletedAt: now, reason } });
    return { deleted: true };
  },
});

export const restorePlatformTicket = mutation({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_support"]);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.deletedAt === undefined) throw new Error("Deleted ticket not found");
    const now = Date.now();
    await ctx.db.patch(ticket._id, { deletedAt: undefined, deletedBy: undefined, deleteReason: undefined, restoredAt: now, restoredBy: actor._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.supportTicket.restored", entityTable: "supportTickets", entityId: ticket._id, changedBy: actor._id, before: { deletedAt: ticket.deletedAt, deleteReason: ticket.deleteReason }, after: { restoredAt: now } });
    return { restored: true };
  },
});
