import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformSubRole, resolveRoles } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

const requestType = v.union(v.literal("export"), v.literal("deletion"));
const requestStatus = v.union(v.literal("received"), v.literal("under_review"), v.literal("completed"), v.literal("rejected"));

async function authorizeIntake(ctx: Parameters<typeof requirePlatformSubRole>[0]) {
  const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_support"]);
  const roles = await resolveRoles(ctx, user);
  const isSuperAdmin = roles.some(role => ["platform_super_admin", "platform_owner", "platform_admin"].includes(role.slug));
  const isSupport = roles.some(role => role.slug === "platform_support");
  if (!isSuperAdmin && !isSupport) throw new Error("Data-request intake is restricted to super-admin and support staff");
  return { user, isSuperAdmin, isSupport };
}

function validateIdentity(nameInput: string, emailInput: string, notesInput: string) {
  const requesterName = nameInput.trim();
  const requesterEmail = emailInput.trim().toLowerCase();
  const requestNotes = notesInput.trim();
  if (!requesterName || requesterName.length > 120) throw new Error("Requester name must be between 1 and 120 characters");
  if (requesterEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail)) throw new Error("Enter a valid requester email address");
  if (!requestNotes || requestNotes.length > 3000) throw new Error("Request details must be between 1 and 3,000 characters");
  return { requesterName, requesterEmail, requestNotes };
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator, includeDeleted: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    const { user, isSuperAdmin } = await authorizeIntake(ctx);
    const base = isSuperAdmin
      ? ctx.db.query("platformDataRequests").withIndex("by_createdAt").order("desc")
      : ctx.db.query("platformDataRequests").withIndex("by_creator_and_createdAt", q => q.eq("createdBy", user._id)).order("desc");
    const page = await base.paginate({
      ...args.paginationOpts,
      numItems: Math.max(1, Math.min(50, Math.floor(args.paginationOpts.numItems))),
    });
    const rows = page.page.filter(row => (isSuperAdmin && args.includeDeleted) || row.deletedAt === undefined);
    return {
      ...page,
      page: await Promise.all(rows.map(async row => {
        const { createdBy, updatedBy, deletedBy, restoredBy, deleteReason, adminNotes, ...publicFields } = row;
        return {
          ...publicFields,
          tenantName: row.tenantId ? (await ctx.db.get(row.tenantId))?.name ?? null : null,
          ...(isSuperAdmin ? { createdBy, updatedBy, deletedBy, restoredBy, deleteReason, adminNotes } : {}),
        };
      })),
    };
  },
});

export const get = query({
  args: { requestId: v.id("platformDataRequests") },
  handler: async (ctx, args) => {
    const { user, isSuperAdmin } = await authorizeIntake(ctx);
    const row = await ctx.db.get(args.requestId);
    if (!row || row.deletedAt !== undefined || (!isSuperAdmin && row.createdBy !== user._id)) return null;
    const { createdBy, updatedBy, deletedBy, restoredBy, deleteReason, adminNotes, ...publicFields } = row;
    return {
      ...publicFields,
      tenantName: row.tenantId ? (await ctx.db.get(row.tenantId))?.name ?? null : null,
      ...(isSuperAdmin ? { createdBy, updatedBy, deletedBy, restoredBy, deleteReason, adminNotes } : {}),
    };
  },
});

export const create = mutation({
  args: {
    tenantId: v.optional(v.id("tenants")),
    requestType,
    requesterName: v.string(),
    requesterEmail: v.string(),
    requestNotes: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await authorizeIntake(ctx);
    if (args.tenantId) {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant is not available");
    }
    const identity = validateIdentity(args.requesterName, args.requesterEmail, args.requestNotes);
    const now = Date.now();
    const id = await ctx.db.insert("platformDataRequests", {
      tenantId: args.tenantId,
      requestType: args.requestType,
      ...identity,
      status: "received",
      createdBy: user._id,
      createdAt: now,
      updatedBy: user._id,
      updatedAt: now,
    });
    await logAudit(ctx, { action: "platform.dataRequest.created", entityTable: "platformDataRequests", entityId: id, changedBy: user._id, after: { requestType: args.requestType, tenantId: args.tenantId ?? null, status: "received" } });
    return id;
  },
});

export const update = mutation({
  args: {
    requestId: v.id("platformDataRequests"),
    tenantId: v.optional(v.id("tenants")),
    requestType: v.optional(requestType),
    requesterName: v.optional(v.string()),
    requesterEmail: v.optional(v.string()),
    requestNotes: v.optional(v.string()),
    status: v.optional(requestStatus),
    adminNotes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const row = await ctx.db.get(args.requestId);
    if (!row || row.deletedAt !== undefined) throw new Error("Data request not found");
    if (args.tenantId !== undefined) {
      const tenant = await ctx.db.get(args.tenantId);
      if (!tenant || tenant.deletedAt !== undefined) throw new Error("Tenant is not available");
    }
    const patch: Record<string, unknown> = { updatedBy: user._id, updatedAt: Date.now() };
    const fieldsUpdated: string[] = [];
    if (args.requestType !== undefined) { patch.requestType = args.requestType; fieldsUpdated.push("requestType"); }
    if (args.tenantId !== undefined && args.tenantId !== row.tenantId) { patch.tenantId = args.tenantId; fieldsUpdated.push("tenantId"); }
    if (args.requesterName !== undefined || args.requesterEmail !== undefined || args.requestNotes !== undefined) {
      const identity = validateIdentity(args.requesterName ?? row.requesterName, args.requesterEmail ?? row.requesterEmail, args.requestNotes ?? row.requestNotes);
      patch.requesterName = identity.requesterName;
      patch.requesterEmail = identity.requesterEmail;
      patch.requestNotes = identity.requestNotes;
      if (args.requesterName !== undefined) fieldsUpdated.push("requesterName");
      if (args.requesterEmail !== undefined) fieldsUpdated.push("requesterEmail");
      if (args.requestNotes !== undefined) fieldsUpdated.push("requestNotes");
    }
    if (args.status !== undefined) { patch.status = args.status; fieldsUpdated.push("status"); }
    if (args.adminNotes !== undefined) {
      if (args.adminNotes.trim().length > 3000) throw new Error("Internal notes must be 3,000 characters or fewer");
      patch.adminNotes = args.adminNotes.trim(); fieldsUpdated.push("adminNotes");
    }
    if (fieldsUpdated.length === 0) throw new Error("Make at least one change before saving");
    await ctx.db.patch(row._id, patch);
    await logAudit(ctx, { action: "platform.dataRequest.updated", entityTable: "platformDataRequests", entityId: row._id, changedBy: user._id, before: { requestType: row.requestType, status: row.status }, after: { requestType: args.requestType ?? row.requestType, status: args.status ?? row.status, fieldsUpdated } });
    return { updated: true };
  },
});

export const remove = mutation({
  args: { requestId: v.id("platformDataRequests"), reason: v.string() },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const row = await ctx.db.get(args.requestId);
    if (!row || row.deletedAt !== undefined) throw new Error("Data request not found");
    const reason = args.reason.trim();
    if (reason.length < 8 || reason.length > 500) throw new Error("Provide an archive reason between 8 and 500 characters");
    const now = Date.now();
    await ctx.db.patch(row._id, { deletedAt: now, deletedBy: user._id, deleteReason: reason, updatedBy: user._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.dataRequest.archived", entityTable: "platformDataRequests", entityId: row._id, changedBy: user._id, before: { status: row.status }, after: { archivedAt: now } });
    return { archived: true };
  },
});

export const restore = mutation({
  args: { requestId: v.id("platformDataRequests") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const row = await ctx.db.get(args.requestId);
    if (!row || row.deletedAt === undefined) throw new Error("Archived data request not found");
    const now = Date.now();
    await ctx.db.patch(row._id, { deletedAt: undefined, deletedBy: undefined, deleteReason: undefined, restoredAt: now, restoredBy: user._id, updatedBy: user._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.dataRequest.restored", entityTable: "platformDataRequests", entityId: row._id, changedBy: user._id, before: { archivedAt: row.deletedAt }, after: { restoredAt: now } });
    return { restored: true };
  },
});
