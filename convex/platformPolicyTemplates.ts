import { paginationOptsValidator } from "convex/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";

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

type PolicyFields = {
  downloadMbps: number; uploadMbps: number; burstDownloadMbps?: number; burstUploadMbps?: number;
  burstThresholdPercent?: number; burstWindowSeconds?: number; concurrentSessions: number; deviceLimit: number;
  dataQuotaGb?: number; timeQuotaHours?: number; fairUseAfterGb?: number; fairUseDownloadMbps?: number; fairUseUploadMbps?: number;
  vlanId?: number; ipPool?: string; staticIpAllowed: boolean; dnsServers: string[]; scheduleStart?: string; scheduleEnd?: string;
  idleTimeoutMinutes?: number; sessionTimeoutHours?: number; firewallProfile?: string; serviceEnabled: boolean;
};

function validatePolicy(fields: PolicyFields) {
  const bounded = (value: number | undefined, min: number, max: number) => value === undefined || (Number.isFinite(value) && value >= min && value <= max);
  if (!bounded(fields.downloadMbps, 0.1, 10000) || !bounded(fields.uploadMbps, 0.1, 10000)) throw new Error("Access speeds must be between 0.1 and 10,000 Mbps");
  if (!bounded(fields.burstDownloadMbps, fields.downloadMbps, 20000) || !bounded(fields.burstUploadMbps, fields.uploadMbps, 20000)) throw new Error("Burst speeds must be at least the standard speed and no more than 20,000 Mbps");
  if (!bounded(fields.burstThresholdPercent, 1, 100) || !bounded(fields.burstWindowSeconds, 1, 3600)) throw new Error("Burst settings are outside the supported range");
  if ((fields.burstThresholdPercent === undefined) !== (fields.burstWindowSeconds === undefined)) throw new Error("Set both burst threshold and window");
  if ((fields.burstDownloadMbps === undefined) !== (fields.burstUploadMbps === undefined)) throw new Error("Set both burst speeds");
  if (!Number.isInteger(fields.concurrentSessions) || !bounded(fields.concurrentSessions, 1, 1000)) throw new Error("Concurrent sessions must be between 1 and 1,000");
  if (!Number.isInteger(fields.deviceLimit) || !bounded(fields.deviceLimit, 1, 1000)) throw new Error("Device limit must be between 1 and 1,000");
  if (!bounded(fields.dataQuotaGb, 0.01, 1000000) || !bounded(fields.timeQuotaHours, 0.01, 87600) || !bounded(fields.fairUseAfterGb, 0.01, 1000000)) throw new Error("Quota values are outside the supported range");
  const hasFairUseRates = fields.fairUseDownloadMbps !== undefined && fields.fairUseUploadMbps !== undefined;
  if ((fields.fairUseAfterGb !== undefined) !== hasFairUseRates || (fields.fairUseDownloadMbps === undefined) !== (fields.fairUseUploadMbps === undefined)) throw new Error("Set a fair-use threshold and both fair-use speeds together");
  if (!bounded(fields.fairUseDownloadMbps, 0.1, fields.downloadMbps) || !bounded(fields.fairUseUploadMbps, 0.1, fields.uploadMbps)) throw new Error("Fair-use speeds must be between 0.1 Mbps and the standard speed");
  if (fields.vlanId !== undefined && (!Number.isInteger(fields.vlanId) || !bounded(fields.vlanId, 1, 4094))) throw new Error("VLAN ID must be between 1 and 4,094");
  if (fields.ipPool && fields.ipPool.length > 100) throw new Error("IP pool name is too long");
  if (fields.dnsServers.length > 4 || fields.dnsServers.some((ip) => !/^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/.test(ip))) throw new Error("Enter up to four valid IPv4 DNS server addresses");
  const time = /^([01]\d|2[0-3]):[0-5]\d$/;
  if ((fields.scheduleStart === undefined) !== (fields.scheduleEnd === undefined) || (fields.scheduleStart !== undefined && (!time.test(fields.scheduleStart) || !time.test(fields.scheduleEnd!)))) throw new Error("Set both schedule times using 24-hour HH:MM format");
  if (!bounded(fields.idleTimeoutMinutes, 1, 10080) || !bounded(fields.sessionTimeoutHours, 0.01, 87600)) throw new Error("Session timeout values are outside the supported range");
  if ((fields.firewallProfile?.length ?? 0) > 80) throw new Error("Firewall profile name is too long");
}

async function insertVersion(ctx: Parameters<typeof logAudit>[0], templateId: string, version: number, fields: PolicyFields, changeNote: string, userId: string) {
  return ctx.db.insert("platformPolicyTemplateVersions", {
    templateId: templateId as never, version, ...fields, changeNote: changeNote.trim(), createdBy: userId as never, createdAt: Date.now(),
  });
}

export const list = query({
  args: { paginationOpts: paginationOptsValidator, includeArchived: v.optional(v.boolean()), includeDeleted: v.optional(v.boolean()) },
  returns: templatePageValidator,
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
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
    await requirePlatformUser(ctx);
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
