import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireMarketAccess, requirePermission, requirePlatformSubRole, resolveRoles } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { PLATFORM_SLA_FALLBACK, ticketDeadlines, type PlatformTicketCategory } from "./lib/platformSlaCore";

const platformTicketReadRoles = ["platform_super_admin", "platform_support", "platform_ops", "platform_finance"];
const platformTicketManageAllRoles = ["platform_super_admin", "platform_support"];
const platformTicketCategory = v.union(v.literal("network"), v.literal("billing"), v.literal("account"));
const platformTicketStatus = v.union(v.literal("open"), v.literal("in_progress"), v.literal("waiting_on_customer"), v.literal("resolved"), v.literal("closed"));
const platformTicketPriority = v.union(v.literal("low"), v.literal("medium"), v.literal("high"), v.literal("urgent"));

async function platformTicketAccess(ctx: Parameters<typeof requirePlatformSubRole>[0]) {
  const user = await requirePlatformSubRole(ctx, platformTicketReadRoles);
  const roles = await resolveRoles(ctx, user);
  const slugs = new Set(roles.map(role => role.slug));
  const isSuperAdmin = slugs.has("platform_owner") || slugs.has("platform_admin");
  const isSupport = slugs.has("platform_support");
  const isOps = slugs.has("ops_manager");
  const isFinance = slugs.has("finance_manager");
  return {
    user,
    canManageAll: isSuperAdmin || isSupport,
    allowedCategories: new Set<PlatformTicketCategory>([
      ...(isSuperAdmin || isSupport ? ["network", "billing", "account"] as const : []),
      ...(isOps ? ["network"] as const : []),
      ...(isFinance ? ["billing"] as const : []),
    ]),
  };
}

async function platformTicketDeadlines(ctx: Parameters<typeof requirePermission>[0], category: PlatformTicketCategory, now: number) {
  const policy = await ctx.db.query("platformSlaPolicies").withIndex("by_category", q => q.eq("category", category)).first();
  return ticketDeadlines(now, policy ?? PLATFORM_SLA_FALLBACK[category]);
}

async function projectPlatformTicket(ctx: Parameters<typeof requirePermission>[0], ticket: Doc<"supportTickets">) {
  const [tenant, market] = await Promise.all([
    ticket.tenantId ? ctx.db.get(ticket.tenantId) : null,
    ticket.marketId ? ctx.db.get(ticket.marketId) : null,
  ]);
  return {
    _id: ticket._id,
    subject: ticket.subject,
    description: ticket.description,
    category: ticket.category ?? "account",
    priority: ticket.priority,
    ticketStatus: ticket.ticketStatus,
    tenantId: ticket.tenantId,
    tenantName: tenant?.name ?? null,
    marketId: ticket.marketId,
    marketName: market?.name ?? null,
    createdAt: ticket.createdAt,
    firstResponseDueAt: ticket.firstResponseDueAt ?? null,
    resolutionDueAt: ticket.resolutionDueAt ?? null,
    deletedAt: ticket.deletedAt,
  };
}

/** Platform-wide ticket list with category filtering enforced at the backend. */
export const listPlatformTickets = query({
  args: {
    paginationOpts: paginationOptsValidator,
    category: v.optional(platformTicketCategory),
    ticketStatus: v.optional(platformTicketStatus),
    includeDeleted: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const access = await platformTicketAccess(ctx);
    if (args.includeDeleted && !access.canManageAll) throw new Error("Unauthorized: deleted tickets are restricted to support managers");
    if (args.category && !access.allowedCategories.has(args.category)) throw new Error("Unauthorized: this role cannot read this ticket category");
    const page = await ctx.db.query("supportTickets").withIndex("by_createdAt").order("desc").paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(args.paginationOpts.numItems, 50)),
    });
    const tickets = page.page.filter(ticket => {
      const category = ticket.category ?? "account";
      return access.allowedCategories.has(category)
        && (args.category === undefined || category === args.category)
        && (args.ticketStatus === undefined || ticket.ticketStatus === args.ticketStatus)
        && (args.includeDeleted === true || ticket.deletedAt === undefined);
    });
    return {
      ...page,
      page: await Promise.all(tickets.map(ticket => projectPlatformTicket(ctx, ticket))),
    };
  },
});

export const getPlatformTicket = query({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const access = await platformTicketAccess(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.deletedAt !== undefined) return null;
    if (!access.allowedCategories.has(ticket.category ?? "account")) throw new Error("Unauthorized: this role cannot read this ticket category");
    const projected = await projectPlatformTicket(ctx, ticket);
    return { ...projected, category: ticket.category ?? "account" };
  },
});

export const createPlatformTicket = mutation({
  args: {
    subject: v.string(), description: v.string(), category: platformTicketCategory, priority: platformTicketPriority,
    tenantId: v.optional(v.id("tenants")), marketId: v.optional(v.id("markets")),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, platformTicketManageAllRoles);
    const subject = args.subject.trim();
    const description = args.description.trim();
    if (subject.length < 3 || subject.length > 180 || description.length < 1 || description.length > 10_000) throw new Error("Enter a subject and description within the allowed lengths");
    let tenantId = args.tenantId;
    if (args.marketId) {
      const market = await ctx.db.get(args.marketId);
      if (!market || (tenantId !== undefined && market.tenantId !== tenantId)) throw new Error("The selected market does not belong to the selected organization");
      tenantId ??= market.tenantId;
    }
    if (tenantId && !await ctx.db.get(tenantId)) throw new Error("Organization not found");
    const now = Date.now();
    const deadlines = await platformTicketDeadlines(ctx, args.category, now);
    const ticketId = await ctx.db.insert("supportTickets", {
      tenantId, marketId: args.marketId, subject, description, category: args.category,
      priority: args.priority, ticketStatus: "open", createdBy: actor._id,
      createdAt: now, updatedAt: now, ...deadlines,
    });
    await logAudit(ctx, { action: "platform.supportTicket.created", entityTable: "supportTickets", entityId: ticketId, changedBy: actor._id, after: { category: args.category, priority: args.priority, tenantId: tenantId ?? null } });
    return ticketId;
  },
});

export const updatePlatformTicket = mutation({
  args: {
    ticketId: v.id("supportTickets"), subject: v.optional(v.string()), description: v.optional(v.string()),
    category: v.optional(platformTicketCategory), priority: v.optional(platformTicketPriority), ticketStatus: v.optional(platformTicketStatus),
  },
  handler: async (ctx, args) => {
    const access = await platformTicketAccess(ctx);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.deletedAt !== undefined) throw new Error("Ticket not found");
    const currentCategory = ticket.category ?? "account";
    if (!access.allowedCategories.has(currentCategory)) throw new Error("Unauthorized: this role cannot update this ticket category");
    const nextCategory = args.category ?? currentCategory;
    if (!access.canManageAll && (nextCategory !== currentCategory || args.subject !== undefined)) throw new Error("Unauthorized: only support managers can edit ticket details");
    if (!access.allowedCategories.has(nextCategory)) throw new Error("Unauthorized: this role cannot move a ticket into this category");
    if (args.subject !== undefined && (args.subject.trim().length < 3 || args.subject.trim().length > 180)) throw new Error("Ticket subject must be between 3 and 180 characters");
    if (args.description !== undefined && (args.description.trim().length < 1 || args.description.length > 10_000)) throw new Error("Ticket description must be 1 to 10,000 characters");
    const now = Date.now();
    const patch: Record<string, unknown> = { updatedAt: now };
    if (args.subject !== undefined) patch.subject = args.subject.trim();
    if (args.description !== undefined) patch.description = args.description.trim();
    if (args.category !== undefined) {
      patch.category = args.category;
      Object.assign(patch, await platformTicketDeadlines(ctx, args.category, now));
    }
    if (args.priority !== undefined) patch.priority = args.priority;
    if (args.ticketStatus !== undefined) {
      patch.ticketStatus = args.ticketStatus;
      if (args.ticketStatus === "resolved") patch.resolvedAt = now;
      if (args.ticketStatus === "closed") patch.closedAt = now;
    }
    if (Object.keys(patch).length === 1) throw new Error("Choose a ticket change before saving");
    await ctx.db.patch(ticket._id, patch);
    await logAudit(ctx, { action: "platform.supportTicket.updated", entityTable: "supportTickets", entityId: ticket._id, changedBy: access.user._id, before: { category: currentCategory, ticketStatus: ticket.ticketStatus, priority: ticket.priority }, after: patch });
    return { updated: true };
  },
});

export const deletePlatformTicket = mutation({
  args: { ticketId: v.id("supportTickets"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, platformTicketManageAllRoles);
    const ticket = await ctx.db.get(args.ticketId);
    const reason = args.reason.trim();
    if (!ticket || ticket.deletedAt !== undefined) throw new Error("Ticket not found");
    if (reason.length < 8 || reason.length > 500) throw new Error("Provide a deletion reason between 8 and 500 characters");
    const now = Date.now();
    await ctx.db.patch(ticket._id, { deletedAt: now, deletedBy: actor._id, deleteReason: reason, updatedAt: now });
    await logAudit(ctx, { action: "platform.supportTicket.deleted", entityTable: "supportTickets", entityId: ticket._id, changedBy: actor._id, after: { reason } });
    return { deleted: true };
  },
});

export const restorePlatformTicket = mutation({
  args: { ticketId: v.id("supportTickets") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, platformTicketManageAllRoles);
    const ticket = await ctx.db.get(args.ticketId);
    if (!ticket || ticket.deletedAt === undefined) throw new Error("Deleted ticket not found");
    const now = Date.now();
    await ctx.db.patch(ticket._id, { deletedAt: undefined, deletedBy: undefined, deleteReason: undefined, restoredAt: now, restoredBy: actor._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.supportTicket.restored", entityTable: "supportTickets", entityId: ticket._id, changedBy: actor._id, after: { restoredAt: now } });
    return { restored: true };
  },
});

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
    category: v.optional(platformTicketCategory),
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
    const deadlines = await platformTicketDeadlines(ctx, category, now);
    const ticketId = await ctx.db.insert("supportTickets", {
      subject: args.subject,
      description: args.description,
      category,
      ticketStatus: "open",
      priority: args.priority,
      marketId: args.marketId,
      agentId: args.agentId,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
      ...deadlines,
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
