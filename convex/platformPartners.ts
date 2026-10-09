import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query, type MutationCtx, type QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { requirePlatformSubRole } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { planPartnerRestore, planPartnerSuspend } from "./lib/platformPartnerLifecycleCore";
import { canTenantOperate } from "./lib/tenantCore";

const partnerType = v.union(v.literal("agency"), v.literal("reseller"));
const status = v.union(v.literal("active"), v.literal("suspended"));
const pageSize = (value: number) => Math.min(50, Math.max(1, Math.floor(value)));

async function project(ctx: { db: { get(id: Id<"tenants">): Promise<Doc<"tenants"> | null> } }, row: Doc<"tenantRelationships">) {
  const [parent, child] = await Promise.all([ctx.db.get(row.parentTenantId), ctx.db.get(row.childTenantId)]);
  return {
    id: row._id,
    type: row.type,
    status: row.status,
    parent: parent && !parent.deletedAt ? { id: parent._id, name: parent.name, slug: parent.slug, status: parent.status } : null,
    partner: child && !child.deletedAt ? { id: child._id, name: child.name, slug: child.slug, status: child.status } : null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    archived: row.deletedAt !== undefined,
  };
}

export const list = query({
  args: { type: partnerType, paginationOpts: paginationOptsValidator, includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"]);
    const page = await ctx.db.query("tenantRelationships").withIndex("by_type", q => q.eq("type", args.type)).order("desc").paginate({ ...args.paginationOpts, numItems: pageSize(args.paginationOpts.numItems) });
    const rows = page.page.filter(row => args.includeArchived || row.deletedAt === undefined);
    return { ...page, page: await Promise.all(rows.map(row => project(ctx, row))) };
  },
});

export const get = query({
  args: { id: v.id("tenantRelationships") },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly"]);
    const row = await ctx.db.get(args.id);
    if (!row || row.deletedAt !== undefined || row.type === "network") return null;
    return project(ctx, row);
  },
});

export const tenantOptions = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const page = await ctx.db.query("tenants").withIndex("by_createdAt").order("desc").paginate({ ...args.paginationOpts, numItems: pageSize(args.paginationOpts.numItems) });
    return { ...page, page: page.page.filter(row => row.deletedAt === undefined).map(row => ({ id: row._id, name: row.name, slug: row.slug, status: row.status })) };
  },
});

async function validatePair(ctx: QueryCtx | MutationCtx, parentId: Id<"tenants">, childId: Id<"tenants">) {
  if (parentId === childId) throw new Error("An organization cannot be its own agency or reseller");
  const [parent, child] = await Promise.all([ctx.db.get(parentId), ctx.db.get(childId)]);
  if (!parent || parent.deletedAt !== undefined || !canTenantOperate(parent.status) || !child || child.deletedAt !== undefined || !canTenantOperate(child.status)) throw new Error("Choose two existing, operating organization records");
  const pending = [childId];
  const visited = new Set<string>();
  let examined = 0;
  while (pending.length) {
    const current = pending.shift()!;
    if (current === parentId) throw new Error("This link would create a circular organization relationship");
    if (visited.has(String(current))) continue;
    visited.add(String(current));
    const links = await ctx.db.query("tenantRelationships").withIndex("by_parent", q => q.eq("parentTenantId", current)).take(101);
    examined += links.length;
    if (examined > 100) throw new Error("Relationship graph exceeds the 100-link validation safety limit");
    for (const link of links) if (link.deletedAt === undefined) pending.push(link.childTenantId);
  }
  return { parent, child };
}

export const create = mutation({
  args: { type: partnerType, parentTenantId: v.id("tenants"), childTenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    await validatePair(ctx, args.parentTenantId, args.childTenantId);
    const existing = await ctx.db.query("tenantRelationships").withIndex("by_parent_child_type", q => q.eq("parentTenantId", args.parentTenantId).eq("childTenantId", args.childTenantId).eq("type", args.type)).first();
    if (existing && existing.deletedAt === undefined) throw new Error("This organization relationship already exists");
    if (existing?.status === "suspended") throw new Error("Restore the suspended relationship before recreating it");
    const now = Date.now();
    let id: Id<"tenantRelationships">;
    if (existing) {
      await ctx.db.patch(existing._id, { status: "active", deletedAt: undefined, deletedBy: undefined, updatedAt: now });
      id = existing._id;
      await logAudit(ctx, { action: "platform.partnerRelationship.restored", entityTable: "tenantRelationships", entityId: id, changedBy: actor._id, before: { status: existing.status, archived: true }, after: { type: args.type, parentTenantId: args.parentTenantId, childTenantId: args.childTenantId, status: "active" } });
    } else {
      id = await ctx.db.insert("tenantRelationships", { ...args, status: "active", createdBy: actor._id, createdAt: now, updatedAt: now });
      await logAudit(ctx, { action: "platform.partnerRelationship.created", entityTable: "tenantRelationships", entityId: id, changedBy: actor._id, after: { ...args, status: "active" } });
    }
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("tenantRelationships"), parentTenantId: v.optional(v.id("tenants")), childTenantId: v.optional(v.id("tenants")) },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const row = await ctx.db.get(args.id);
    if (!row || row.deletedAt !== undefined) throw new Error("Active partner relationship not found");
    const parentTenantId = args.parentTenantId ?? row.parentTenantId;
    const childTenantId = args.childTenantId ?? row.childTenantId;
    await validatePair(ctx, parentTenantId, childTenantId);
    if (parentTenantId !== row.parentTenantId || childTenantId !== row.childTenantId) {
      const duplicate = await ctx.db.query("tenantRelationships").withIndex("by_parent_child_type", q => q.eq("parentTenantId", parentTenantId).eq("childTenantId", childTenantId).eq("type", row.type)).first();
      if (duplicate && duplicate._id !== row._id && duplicate.deletedAt === undefined) throw new Error("This organization relationship already exists");
    }
    const patch: Partial<Doc<"tenantRelationships">> = { updatedAt: Date.now() };
    if (args.parentTenantId !== undefined) patch.parentTenantId = parentTenantId;
    if (args.childTenantId !== undefined) patch.childTenantId = childTenantId;
    if (Object.keys(patch).length === 1) throw new Error("Choose a relationship change before saving");
    await ctx.db.patch(row._id, patch);
    await logAudit(ctx, { action: "platform.partnerRelationship.updated", entityTable: "tenantRelationships", entityId: row._id, changedBy: actor._id, before: { parentTenantId: row.parentTenantId, childTenantId: row.childTenantId, status: row.status }, after: { parentTenantId, childTenantId, status: row.status } });
    return { updated: true };
  },
});

export const archive = mutation({
  args: { id: v.id("tenantRelationships") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const row = await ctx.db.get(args.id);
    if (!row || row.deletedAt !== undefined || row.type === "network") throw new Error("Active partner relationship not found");
    if (row.status === "suspended") throw new Error("Restore the relationship before archiving it so descendant access state can be reconciled");
    const now = Date.now();
    await ctx.db.patch(row._id, { deletedAt: now, deletedBy: actor._id, updatedAt: now });
    await logAudit(ctx, { action: "platform.partnerRelationship.archived", entityTable: "tenantRelationships", entityId: row._id, changedBy: actor._id, before: { type: row.type, parentTenantId: row.parentTenantId, childTenantId: row.childTenantId, status: row.status }, after: { archived: true } });
    return { archived: true };
  },
});


/** Suspend the partner relationship and every linked descendant relationship. */
export const suspend = mutation({
  args: { id: v.id("tenantRelationships"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const root = await ctx.db.get(args.id);
    const reason = args.reason.trim();
    if (!root || root.deletedAt !== undefined || root.type === "network") throw new Error("Active agency or reseller relationship not found");
    if (reason.length < 8 || reason.length > 500) throw new Error("Provide a suspension reason between 8 and 500 characters");
    if (root.status === "suspended") throw new Error("This relationship is already suspended");
    const now = Date.now();
    const visited = new Set<string>([String(root._id)]);
    const pending: Id<"tenants">[] = [root.childTenantId];
    const descendants: Doc<"tenantRelationships">[] = [];
    while (pending.length) {
      const parentId = pending.shift()!;
      const rows = await ctx.db.query("tenantRelationships").withIndex("by_parent", q => q.eq("parentTenantId", parentId)).take(101);
      if (rows.length > 100) throw new Error("Organization relationship fan-out exceeds safety limits; no changes were applied");
      for (const row of rows) {
        if (row.deletedAt !== undefined || visited.has(String(row._id))) continue;
        visited.add(String(row._id));
        if (visited.size > 100) throw new Error("Relationship tree exceeds the 100-link suspension safety limit; no changes were applied");
        descendants.push(row);
        pending.push(row.childTenantId);
      }
    }
    const plan = planPartnerSuspend(
      { id: String(root._id), status: root.status, statusBeforeSuspension: root.statusBeforeSuspension, suspendedByRelationshipId: root.suspendedByRelationshipId ? String(root.suspendedByRelationshipId) : undefined },
      descendants.map(row => ({ id: String(row._id), status: row.status, statusBeforeSuspension: row.statusBeforeSuspension, suspendedByRelationshipId: row.suspendedByRelationshipId ? String(row.suspendedByRelationshipId) : undefined })),
    );
    await ctx.db.patch(root._id, { status: plan.rootPatch.status, statusBeforeSuspension: plan.rootPatch.statusBeforeSuspension, suspendedByRelationshipId: undefined, updatedAt: now });
    for (const item of plan.descendantPatches) {
      const row = descendants.find(candidate => String(candidate._id) === item.id)!;
      await ctx.db.patch(row._id, { status: item.patch.status, statusBeforeSuspension: item.patch.statusBeforeSuspension, suspendedByRelationshipId: root._id, updatedAt: now });
    }
    await logAudit(ctx, { action: "platform.partner.suspended", entityTable: "tenantRelationships", entityId: root._id, changedBy: actor._id, before: { status: root.status, descendantRelationshipCount: descendants.length }, after: { status: "suspended", descendantRelationshipCount: plan.descendantPatches.length, reason } });
    return { suspended: true, affectedRelationships: 1 + plan.descendantPatches.length };
  },
});

/** Restore only descendants suspended by this root action, preserving independent suspensions. */
export const restore = mutation({
  args: { id: v.id("tenantRelationships"), reason: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, ["platform_super_admin"]);
    const root = await ctx.db.get(args.id);
    const reason = args.reason.trim();
    if (!root || root.deletedAt !== undefined || root.type === "network" || root.status !== "suspended") throw new Error("Suspended agency or reseller relationship not found");
    if (reason.length < 8 || reason.length > 500) throw new Error("Provide a restoration reason between 8 and 500 characters");
    const now = Date.now();
    const visited = new Set<string>([String(root._id)]);
    const pending: Id<"tenants">[] = [root.childTenantId];
    const descendants: Doc<"tenantRelationships">[] = [];
    while (pending.length) {
      const parentId = pending.shift()!;
      const rows = await ctx.db.query("tenantRelationships").withIndex("by_parent", q => q.eq("parentTenantId", parentId)).take(101);
      if (rows.length > 100) throw new Error("Organization relationship fan-out exceeds safety limits; no changes were applied");
      for (const row of rows) {
        if (row.deletedAt !== undefined || visited.has(String(row._id))) continue;
        visited.add(String(row._id));
        if (visited.size > 100) throw new Error("Relationship tree exceeds the 100-link restore safety limit; no changes were applied");
        descendants.push(row);
        pending.push(row.childTenantId);
      }
    }
    const plan = planPartnerRestore(
      { id: String(root._id), status: root.status, statusBeforeSuspension: root.statusBeforeSuspension, suspendedByRelationshipId: root.suspendedByRelationshipId ? String(root.suspendedByRelationshipId) : undefined },
      descendants.map(row => ({ id: String(row._id), status: row.status, statusBeforeSuspension: row.statusBeforeSuspension, suspendedByRelationshipId: row.suspendedByRelationshipId ? String(row.suspendedByRelationshipId) : undefined })),
    );
    await ctx.db.patch(root._id, { status: plan.rootPatch.status, statusBeforeSuspension: plan.rootPatch.statusBeforeSuspension, suspendedByRelationshipId: undefined, updatedAt: now });
    for (const item of plan.descendantPatches) {
      const row = descendants.find(candidate => String(candidate._id) === item.id)!;
      await ctx.db.patch(row._id, { status: item.patch.status, statusBeforeSuspension: item.patch.statusBeforeSuspension, suspendedByRelationshipId: item.patch.suspendedByRelationshipId, updatedAt: now });
    }
    await logAudit(ctx, { action: "platform.partner.restored", entityTable: "tenantRelationships", entityId: root._id, changedBy: actor._id, before: { status: "suspended", descendantRelationshipCount: descendants.length }, after: { status: "active", descendantRelationshipCount: plan.descendantPatches.length, reason } });
    return { restored: true, affectedRelationships: plan.descendantPatches.length + 1 };
  },
});
