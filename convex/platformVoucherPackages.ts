import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

const packageTypeValidator = v.union(v.literal("half_day"), v.literal("day"), v.literal("week"), v.literal("month"), v.literal("specialty"));
const statusValidator = v.union(v.literal("active"), v.literal("archived"));
const packageFieldsValidator = v.object({
  code: v.string(), name: v.string(), description: v.string(), packageType: packageTypeValidator,
  durationHours: v.number(), currency: v.string(), priceEach: v.number(), dataQuotaMb: v.optional(v.number()),
  downloadMbps: v.optional(v.number()), uploadMbps: v.optional(v.number()), deviceLimit: v.number(),
});
const packageValidator = v.object({
  _id: v.id("platformVoucherPackageTemplates"), _creationTime: v.number(), code: v.string(), name: v.string(), description: v.string(),
  packageType: packageTypeValidator, durationHours: v.number(), currency: v.string(), priceEach: v.number(), dataQuotaMb: v.optional(v.number()),
  downloadMbps: v.optional(v.number()), uploadMbps: v.optional(v.number()), deviceLimit: v.number(), status: statusValidator, revision: v.number(),
  createdBy: v.id("users"), createdAt: v.number(), updatedAt: v.number(), updatedBy: v.id("users"), deletedAt: v.optional(v.number()), deletedBy: v.optional(v.id("users")),
});
const pageValidator = v.object({ items: v.array(packageValidator), continueCursor: v.union(v.string(), v.null()), isDone: v.boolean() });

function validate(args: { code: string; name: string; description: string; durationHours: number; currency: string; priceEach: number; dataQuotaMb?: number; downloadMbps?: number; uploadMbps?: number; deviceLimit: number }) {
  if (!/^[a-z][a-z0-9-]{1,39}$/.test(args.code.trim().toLowerCase())) throw new Error("Package code must use 2–40 lowercase letters, numbers, or hyphens");
  if (args.name.trim().length < 2 || args.name.trim().length > 80) throw new Error("Package name must be 2–80 characters");
  if (args.description.trim().length > 500) throw new Error("Description must be 500 characters or fewer");
  if (!Number.isFinite(args.durationHours) || args.durationHours <= 0 || args.durationHours > 8760) throw new Error("Validity must be between 0 and 8,760 hours");
  if (!/^[A-Z]{3}$/.test(args.currency)) throw new Error("Enter a three-letter currency code");
  if (!Number.isFinite(args.priceEach) || args.priceEach < 0 || args.priceEach > 100000000) throw new Error("Price must be between 0 and 100,000,000");
  if (args.dataQuotaMb !== undefined && (!Number.isFinite(args.dataQuotaMb) || args.dataQuotaMb <= 0 || args.dataQuotaMb > 1000000000)) throw new Error("Data quota must be greater than 0 and no more than 1,000,000,000 MB");
  if ((args.downloadMbps === undefined) !== (args.uploadMbps === undefined)) throw new Error("Set both download and upload speeds");
  if (args.downloadMbps !== undefined && (!Number.isFinite(args.downloadMbps) || args.downloadMbps <= 0 || args.downloadMbps > 10000 || !Number.isFinite(args.uploadMbps) || args.uploadMbps! <= 0 || args.uploadMbps! > 10000)) throw new Error("Speeds must be between 0 and 10,000 Mbps");
  if (!Number.isInteger(args.deviceLimit) || args.deviceLimit < 1 || args.deviceLimit > 1000) throw new Error("Device limit must be between 1 and 1,000");
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator, includeArchived: v.optional(v.boolean()), includeDeleted: v.optional(v.boolean()) },
  returns: pageValidator,
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const query = args.includeArchived
      ? ctx.db.query("platformVoucherPackageTemplates")
      : ctx.db.query("platformVoucherPackageTemplates").withIndex("by_status_and_updatedAt", (q) => q.eq("status", "active"));
    const page = await query.order("desc").paginate({ ...args.paginationOpts, numItems: Math.max(1, Math.min(args.paginationOpts.numItems, 50)) });
    const items = page.page.filter((item) => args.includeDeleted || item.deletedAt === undefined);
    return { items, continueCursor: page.isDone ? null : page.continueCursor, isDone: page.isDone };
  },
});

export const create = mutation({
  args: { fields: packageFieldsValidator },
  returns: v.id("platformVoucherPackageTemplates"),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    validate(args.fields);
    const code = args.fields.code.trim().toLowerCase();
    if (await ctx.db.query("platformVoucherPackageTemplates").withIndex("by_code", (q) => q.eq("code", code)).first()) throw new Error("A voucher package with this code already exists");
    const now = Date.now();
    const id = await ctx.db.insert("platformVoucherPackageTemplates", { ...args.fields, code, name: args.fields.name.trim(), description: args.fields.description.trim(), status: "active", revision: 1, createdBy: user._id, createdAt: now, updatedAt: now, updatedBy: user._id });
    await logAudit(ctx, { action: "platform_voucher_package.created", entityTable: "platformVoucherPackageTemplates", entityId: id, changedBy: user._id, after: { code, packageType: args.fields.packageType, currency: args.fields.currency } });
    return id;
  },
});

export const update = mutation({
  args: { packageId: v.id("platformVoucherPackageTemplates"), expectedRevision: v.number(), fields: packageFieldsValidator },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const item = await ctx.db.get(args.packageId);
    if (!item || item.deletedAt !== undefined) throw new Error("Voucher package not found");
    if (item.revision !== args.expectedRevision) throw new Error("Package changed. Refresh and review the latest details");
    validate(args.fields);
    const code = args.fields.code.trim().toLowerCase();
    if (code !== item.code && await ctx.db.query("platformVoucherPackageTemplates").withIndex("by_code", (q) => q.eq("code", code)).first()) throw new Error("A voucher package with this code already exists");
    const now = Date.now();
    await ctx.db.patch(item._id, { ...args.fields, code, name: args.fields.name.trim(), description: args.fields.description.trim(), revision: item.revision + 1, updatedAt: now, updatedBy: user._id });
    await logAudit(ctx, { action: "platform_voucher_package.updated", entityTable: "platformVoucherPackageTemplates", entityId: item._id, changedBy: user._id, before: { code: item.code, priceEach: item.priceEach, currency: item.currency }, after: { code, priceEach: args.fields.priceEach, currency: args.fields.currency } });
    return { updated: true };
  },
});

export const setStatus = mutation({
  args: { packageId: v.id("platformVoucherPackageTemplates"), status: statusValidator },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const item = await ctx.db.get(args.packageId);
    if (!item || item.deletedAt !== undefined) throw new Error("Voucher package not found");
    await ctx.db.patch(item._id, { status: args.status, updatedAt: Date.now(), updatedBy: user._id });
    await logAudit(ctx, { action: `platform_voucher_package.${args.status}`, entityTable: "platformVoucherPackageTemplates", entityId: item._id, changedBy: user._id, before: { status: item.status }, after: { status: args.status } });
    return { updated: true };
  },
});

export const remove = mutation({
  args: { packageId: v.id("platformVoucherPackageTemplates"), reason: v.string() },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const item = await ctx.db.get(args.packageId);
    if (!item || item.deletedAt !== undefined) throw new Error("Voucher package not found");
    if (args.reason.trim().length < 8 || args.reason.trim().length > 300) throw new Error("Add a deletion reason between 8 and 300 characters");
    await ctx.db.patch(item._id, { deletedAt: Date.now(), deletedBy: user._id, status: "archived", updatedAt: Date.now(), updatedBy: user._id });
    await logAudit(ctx, { action: "platform_voucher_package.deleted", entityTable: "platformVoucherPackageTemplates", entityId: item._id, changedBy: user._id, after: { reason: args.reason.trim() } });
    return { deleted: true };
  },
});

export const restore = mutation({
  args: { packageId: v.id("platformVoucherPackageTemplates") },
  returns: v.object({ restored: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const item = await ctx.db.get(args.packageId);
    if (!item || item.deletedAt === undefined) throw new Error("Deleted voucher package not found");
    await ctx.db.patch(item._id, { deletedAt: undefined, deletedBy: undefined, status: "active", updatedAt: Date.now(), updatedBy: user._id });
    await logAudit(ctx, { action: "platform_voucher_package.restored", entityTable: "platformVoucherPackageTemplates", entityId: item._id, changedBy: user._id, after: { status: "active" } });
    return { restored: true };
  },
});
