import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformSubRole } from "./lib/auth";
import { PLATFORM_SUB_ROLE_READERS } from "./lib/permissions";
import { logAudit } from "./lib/auditLog";
import { validatePolicy, type PolicyFields } from "./lib/platformPolicyTemplateCore";

const accessTypeValidator = v.union(v.literal("pppoe"), v.literal("hotspot"), v.literal("both"));
const statusValidator = v.union(v.literal("active"), v.literal("archived"));

const policyFieldsValidator = v.object({
  downloadMbps: v.number(), uploadMbps: v.number(),
  burstDownloadMbps: v.optional(v.number()), burstUploadMbps: v.optional(v.number()),
  burstThresholdPercent: v.optional(v.number()), burstWindowSeconds: v.optional(v.number()),
  concurrentSessions: v.number(), deviceLimit: v.number(),
  dataQuotaGb: v.optional(v.number()), timeQuotaHours: v.optional(v.number()),
  fairUseAfterGb: v.optional(v.number()), fairUseDownloadMbps: v.optional(v.number()), fairUseUploadMbps: v.optional(v.number()),
  vlanId: v.optional(v.number()), ipPool: v.optional(v.string()), staticIpAllowed: v.boolean(),
  dnsServers: v.array(v.string()), scheduleStart: v.optional(v.string()), scheduleEnd: v.optional(v.string()),
  idleTimeoutMinutes: v.optional(v.number()), sessionTimeoutHours: v.optional(v.number()),
  firewallProfile: v.optional(v.string()), serviceEnabled: v.boolean(),
});

const policyVersionValidator = v.object({
  _id: v.id("platformPolicyTemplateVersions"), _creationTime: v.number(), templateId: v.id("platformPolicyTemplates"), version: v.number(),
  downloadMbps: v.number(), uploadMbps: v.number(), burstDownloadMbps: v.optional(v.number()), burstUploadMbps: v.optional(v.number()),
  burstThresholdPercent: v.optional(v.number()), burstWindowSeconds: v.optional(v.number()), concurrentSessions: v.number(), deviceLimit: v.number(),
  dataQuotaGb: v.optional(v.number()), timeQuotaHours: v.optional(v.number()), fairUseAfterGb: v.optional(v.number()),
  fairUseDownloadMbps: v.optional(v.number()), fairUseUploadMbps: v.optional(v.number()), vlanId: v.optional(v.number()),
  ipPool: v.optional(v.string()), staticIpAllowed: v.boolean(), dnsServers: v.array(v.string()), scheduleStart: v.optional(v.string()),
  scheduleEnd: v.optional(v.string()), idleTimeoutMinutes: v.optional(v.number()), sessionTimeoutHours: v.optional(v.number()),
  firewallProfile: v.optional(v.string()), serviceEnabled: v.boolean(), changeNote: v.string(), createdBy: v.id("users"), createdAt: v.number(),
});

const templateValidator = v.object({
  _id: v.id("platformPolicyTemplates"), _creationTime: v.number(), code: v.string(), name: v.string(), description: v.string(),
  accessType: accessTypeValidator, currentVersion: v.number(), status: statusValidator, createdBy: v.id("users"), createdAt: v.number(),
  updatedAt: v.number(), updatedBy: v.id("users"), deletedAt: v.optional(v.number()), deletedBy: v.optional(v.id("users")),
});
const templateWithCurrentValidator = v.object({ template: templateValidator, current: v.union(policyVersionValidator, v.null()) });
const templatePageValidator = v.object({ items: v.array(templateWithCurrentValidator), continueCursor: v.union(v.string(), v.null()), isDone: v.boolean() });

async function insertVersion(ctx: Parameters<typeof logAudit>[0], templateId: string, version: number, fields: PolicyFields, changeNote: string, userId: string) {
  return ctx.db.insert("platformPolicyTemplateVersions", {
    templateId: templateId as never, version, ...fields, changeNote: changeNote.trim(), createdBy: userId as never, createdAt: Date.now(),
  });
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator, includeArchived: v.optional(v.boolean()), includeDeleted: v.optional(v.boolean()) },
  returns: templatePageValidator,
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, [...PLATFORM_SUB_ROLE_READERS]);
    const pageSize = Math.max(1, Math.min(args.paginationOpts.numItems, 50));
    const source = args.includeArchived
      ? ctx.db.query("platformPolicyTemplates")
      : ctx.db.query("platformPolicyTemplates").withIndex("by_status_and_updatedAt", (q) => q.eq("status", "active"));
    const page = await source.order("desc").paginate({ ...args.paginationOpts, numItems: pageSize });
    const templates = page.page.filter((row) => args.includeDeleted || row.deletedAt === undefined);
    const items = await Promise.all(templates.map(async (template) => ({
      template,
      current: await ctx.db.query("platformPolicyTemplateVersions")
        .withIndex("by_template_and_version", (q) => q.eq("templateId", template._id).eq("version", template.currentVersion))
        .first(),
    })));
    return { items, continueCursor: page.isDone ? null : page.continueCursor, isDone: page.isDone };
  },
});

export const get = query({
  args: { templateId: v.id("platformPolicyTemplates") },
  returns: v.union(v.null(), v.object({ ...templateWithCurrentValidator.fields, versions: v.array(policyVersionValidator) })),
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, [...PLATFORM_SUB_ROLE_READERS]);
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;
    const [current, versions] = await Promise.all([
      ctx.db.query("platformPolicyTemplateVersions").withIndex("by_template_and_version", (q) => q.eq("templateId", template._id).eq("version", template.currentVersion)).first(),
      ctx.db.query("platformPolicyTemplateVersions").withIndex("by_template_and_version", (q) => q.eq("templateId", template._id)).order("desc").take(50),
    ]);
    return { template, current, versions };
  },
});

export const create = mutation({
  args: {
    code: v.string(), name: v.string(), description: v.string(), accessType: accessTypeValidator,
    fields: policyFieldsValidator, changeNote: v.string(),
  },
  returns: v.id("platformPolicyTemplates"),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const code = args.code.trim().toLowerCase();
    if (!/^[a-z][a-z0-9-]{1,39}$/.test(code)) throw new Error("Template code must use 2–40 lowercase letters, numbers, or hyphens");
    if (args.name.trim().length < 2 || args.name.trim().length > 80) throw new Error("Template name must be 2–80 characters");
    if (args.description.trim().length > 500) throw new Error("Description must be 500 characters or fewer");
    if (args.changeNote.trim().length < 8 || args.changeNote.trim().length > 300) throw new Error("Add a change note between 8 and 300 characters");
    validatePolicy(args.fields);
    if (await ctx.db.query("platformPolicyTemplates").withIndex("by_code", (q) => q.eq("code", code)).first()) throw new Error("A template with this code already exists");
    const now = Date.now();
    const templateId = await ctx.db.insert("platformPolicyTemplates", {
      code, name: args.name.trim(), description: args.description.trim(), accessType: args.accessType,
      currentVersion: 1, status: "active", createdBy: user._id, createdAt: now, updatedAt: now, updatedBy: user._id,
    });
    await insertVersion(ctx, templateId, 1, args.fields, args.changeNote, user._id);
    await logAudit(ctx, { action: "platform_policy_template.created", entityTable: "platformPolicyTemplates", entityId: templateId, changedBy: user._id, after: { code, name: args.name.trim(), version: 1 } });
    return templateId;
  },
});

export const update = mutation({
  args: {
    templateId: v.id("platformPolicyTemplates"), expectedVersion: v.number(), name: v.string(), description: v.string(),
    accessType: accessTypeValidator, fields: policyFieldsValidator, changeNote: v.string(),
  },
  returns: v.number(),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.deletedAt !== undefined) throw new Error("Policy template not found");
    if (template.currentVersion !== args.expectedVersion) throw new Error("Template changed. Refresh and review the latest version");
    if (args.name.trim().length < 2 || args.name.trim().length > 80) throw new Error("Template name must be 2–80 characters");
    if (args.description.trim().length > 500) throw new Error("Description must be 500 characters or fewer");
    if (args.changeNote.trim().length < 8 || args.changeNote.trim().length > 300) throw new Error("Add a change note between 8 and 300 characters");
    validatePolicy(args.fields);
    const version = template.currentVersion + 1;
    await insertVersion(ctx, template._id, version, args.fields, args.changeNote, user._id);
    await ctx.db.patch(template._id, { name: args.name.trim(), description: args.description.trim(), accessType: args.accessType, currentVersion: version, updatedAt: Date.now(), updatedBy: user._id });
    await logAudit(ctx, { action: "platform_policy_template.version_created", entityTable: "platformPolicyTemplates", entityId: template._id, changedBy: user._id, before: { version: template.currentVersion }, after: { version, changeNote: args.changeNote.trim() } });
    return version;
  },
});

export const restoreVersion = mutation({
  args: { templateId: v.id("platformPolicyTemplates"), version: v.number(), changeNote: v.string() },
  returns: v.number(),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.deletedAt !== undefined) throw new Error("Policy template not found");
    const prior = await ctx.db.query("platformPolicyTemplateVersions").withIndex("by_template_and_version", (q) => q.eq("templateId", template._id).eq("version", args.version)).first();
    if (!prior) throw new Error("Template version not found");
    if (args.changeNote.trim().length < 8 || args.changeNote.trim().length > 300) throw new Error("Add a change note between 8 and 300 characters");
    const { _id: _priorId, _creationTime: _created, templateId: _templateId, version: _version, createdBy: _author, createdAt: _time, changeNote: _note, ...fields } = prior;
    const version = template.currentVersion + 1;
    await insertVersion(ctx, template._id, version, fields, args.changeNote, user._id);
    await ctx.db.patch(template._id, { currentVersion: version, updatedAt: Date.now(), updatedBy: user._id });
    await logAudit(ctx, { action: "platform_policy_template.version_restored", entityTable: "platformPolicyTemplates", entityId: template._id, changedBy: user._id, before: { version: template.currentVersion }, after: { version, restoredFrom: args.version } });
    return version;
  },
});

export const setStatus = mutation({
  args: { templateId: v.id("platformPolicyTemplates"), status: statusValidator },
  returns: v.object({ updated: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.deletedAt !== undefined) throw new Error("Policy template not found");
    await ctx.db.patch(template._id, { status: args.status, updatedAt: Date.now(), updatedBy: user._id });
    await logAudit(ctx, { action: `platform_policy_template.${args.status}`, entityTable: "platformPolicyTemplates", entityId: template._id, changedBy: user._id, before: { status: template.status }, after: { status: args.status } });
    return { updated: true };
  },
});

export const remove = mutation({
  args: { templateId: v.id("platformPolicyTemplates"), reason: v.string() },
  returns: v.object({ deleted: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.deletedAt !== undefined) throw new Error("Policy template not found");
    if (args.reason.trim().length < 8 || args.reason.trim().length > 300) throw new Error("Add a deletion reason between 8 and 300 characters");
    await ctx.db.patch(template._id, { deletedAt: Date.now(), deletedBy: user._id, status: "archived", updatedAt: Date.now(), updatedBy: user._id });
    await logAudit(ctx, { action: "platform_policy_template.deleted", entityTable: "platformPolicyTemplates", entityId: template._id, changedBy: user._id, before: { status: template.status }, after: { deleted: true, reason: args.reason.trim() } });
    return { deleted: true };
  },
});

export const restore = mutation({
  args: { templateId: v.id("platformPolicyTemplates") },
  returns: v.object({ restored: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin", "platform_ops"]);
    const template = await ctx.db.get(args.templateId);
    if (!template || template.deletedAt === undefined) throw new Error("Deleted policy template not found");
    await ctx.db.patch(template._id, { deletedAt: undefined, deletedBy: undefined, status: "active", updatedAt: Date.now(), updatedBy: user._id });
    await logAudit(ctx, { action: "platform_policy_template.restored", entityTable: "platformPolicyTemplates", entityId: template._id, changedBy: user._id, after: { status: "active" } });
    return { restored: true };
  },
});
