import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { requirePlatformSubRole, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import {
  buildPolicyTemplateRow,
  isValidPolicyTemplateCode,
  isValidPolicyTemplateName,
  isValidRateMbps,
  isValidBurstMbps,
  isPolicyTemplateKind,
  isPolicyTemplateStatus,
  isPolicyVersionFrozen,
  nextPolicyTemplateVersion,
  type PolicyTemplateKind,
  type PolicyTemplateStatus,
} from "./lib/policyTemplateCore";

/**
 * Versioned PPPoE / rate-limit policy templates (spec B4). Each family
 * (identified by a stable code) is versioned 1..n; published versions are
 * immutable. Reads: any platform user. Writes: platform_super_admin or
 * platform_ops, per the B4 CRUD matrix. Retire/super_admin only.
 */
export const listPolicyTemplates = query({
  args: {
    kind: v.optional(v.string()),
    status: v.optional(v.string()),
    code: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    if (args.kind !== undefined && !isPolicyTemplateKind(args.kind)) {
      throw new Error("Unknown kind filter");
    }
    if (args.status !== undefined && !isPolicyTemplateStatus(args.status)) {
      throw new Error("Unknown status filter");
    }

    let templates = await ctx.db.query("policyTemplates").collect();
    if (args.kind !== undefined) {
      templates = templates.filter((t) => t.kind === args.kind);
    }
    if (args.status !== undefined) {
      templates = templates.filter((t) => t.status === args.status);
    }
    if (args.code !== undefined) {
      templates = templates.filter((t) => t.code === args.code);
    }
    templates.sort(
      (a, b) => (a.code > b.code ? 1 : a.code < b.code ? -1 : b.version - a.version),
    );

    return templates.map((t) =>
      buildPolicyTemplateRow({
        _id: t._id,
        code: t.code,
        name: t.name,
        version: t.version,
        kind: t.kind,
        downloadMbps: t.downloadMbps,
        uploadMbps: t.uploadMbps,
        burstDownloadMbps: t.burstDownloadMbps,
        burstUploadMbps: t.burstUploadMbps,
        burstThresholdMbps: t.burstThresholdMbps,
        burstTimeSeconds: t.burstTimeSeconds,
        status: t.status,
        description: t.description,
        createdBy: t.createdBy,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }),
    );
  },
});

export const getPolicyTemplateRow = query({
  args: { templateId: v.id("policyTemplates") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const template = await ctx.db.get(args.templateId);
    if (!template) return null;
    return buildPolicyTemplateRow({
      _id: template._id,
      code: template.code,
      name: template.name,
      version: template.version,
      kind: template.kind,
      downloadMbps: template.downloadMbps,
      uploadMbps: template.uploadMbps,
      burstDownloadMbps: template.burstDownloadMbps,
      burstUploadMbps: template.burstUploadMbps,
      burstThresholdMbps: template.burstThresholdMbps,
      burstTimeSeconds: template.burstTimeSeconds,
      status: template.status,
      description: template.description,
      createdBy: template.createdBy,
      createdAt: template.createdAt,
      updatedAt: template.updatedAt,
    });
  },
});

/**
 * Create the first version (v1) of a new policy template family. The code
 * must be unique across all families; duplicates are rejected.
 */
export const createPolicyTemplate = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    kind: v.union(v.literal("pppoe"), v.literal("rate_limit")),
    downloadMbps: v.number(),
    uploadMbps: v.number(),
    burstDownloadMbps: v.optional(v.number()),
    burstUploadMbps: v.optional(v.number()),
    burstThresholdMbps: v.optional(v.number()),
    burstTimeSeconds: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    if (!isValidPolicyTemplateCode(args.code)) {
      throw new Error(
        "Code must be 2-80 lowercase alphanumeric/hyphen chars",
      );
    }
    if (!isValidPolicyTemplateName(args.name)) {
      throw new Error("Name must be 3-80 characters");
    }
    if (!isValidRateMbps(args.downloadMbps)) {
      throw new Error("downloadMbps must be a positive number ≤ 1,000,000");
    }
    if (!isValidRateMbps(args.uploadMbps)) {
      throw new Error("uploadMbps must be a positive number ≤ 1,000,000");
    }
    if (!isValidBurstMbps(args.burstDownloadMbps)) {
      throw new Error("burstDownloadMbps must be 0–1,000,000 when provided");
    }
    if (!isValidBurstMbps(args.burstUploadMbps)) {
      throw new Error("burstUploadMbps must be 0–1,000,000 when provided");
    }

    // Ensure code is unique across all families
    const existing = await ctx.db
      .query("policyTemplates")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .first();
    if (existing) {
      throw new Error(`Template family "${args.code}" already exists`);
    }

    const now = Date.now();
    const templateId = await ctx.db.insert("policyTemplates", {
      code: args.code,
      name: args.name,
      version: 1,
      kind: args.kind as PolicyTemplateKind,
      downloadMbps: args.downloadMbps,
      uploadMbps: args.uploadMbps,
      burstDownloadMbps: args.burstDownloadMbps,
      burstUploadMbps: args.burstUploadMbps,
      burstThresholdMbps: args.burstThresholdMbps,
      burstTimeSeconds: args.burstTimeSeconds,
      status: "draft" as PolicyTemplateStatus,
      description: args.description,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "policyTemplate.create",
      entityTable: "policyTemplates",
      entityId: templateId,
      changedBy: user._id,
      after: {
        code: args.code,
        name: args.name,
        version: 1,
        kind: args.kind,
      },
    });

    return templateId;
  },
});

/**
 * Create a new version of an existing family. The family must exist. Content
 * is copied from the latest version but editable; status starts as "draft".
 */
export const createPolicyTemplateVersion = mutation({
  args: {
    code: v.string(),
    name: v.string(),
    downloadMbps: v.number(),
    uploadMbps: v.number(),
    burstDownloadMbps: v.optional(v.number()),
    burstUploadMbps: v.optional(v.number()),
    burstThresholdMbps: v.optional(v.number()),
    burstTimeSeconds: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    if (!isValidPolicyTemplateName(args.name)) {
      throw new Error("Name must be 3-80 characters");
    }
    if (!isValidRateMbps(args.downloadMbps)) {
      throw new Error("downloadMbps must be a positive number ≤ 1,000,000");
    }
    if (!isValidRateMbps(args.uploadMbps)) {
      throw new Error("uploadMbps must be a positive number ≤ 1,000,000");
    }
    if (!isValidBurstMbps(args.burstDownloadMbps)) {
      throw new Error("burstDownloadMbps must be 0–1,000,000 when provided");
    }
    if (!isValidBurstMbps(args.burstUploadMbps)) {
      throw new Error("burstUploadMbps must be 0–1,000,000 when provided");
    }

    // Find the latest version in the family to read its kind
    const existingVersions = await ctx.db
      .query("policyTemplates")
      .withIndex("by_code", (q) => q.eq("code", args.code))
      .collect();
    if (existingVersions.length === 0) {
      throw new Error(`Template family "${args.code}" not found`);
    }
    const latestExisting = existingVersions.reduce(
      (a, b) => (a.version > b.version ? a : b),
    );

    const newVersion = nextPolicyTemplateVersion(latestExisting.version);
    const now = Date.now();

    const templateId = await ctx.db.insert("policyTemplates", {
      code: args.code,
      name: args.name,
      version: newVersion,
      kind: latestExisting.kind,
      downloadMbps: args.downloadMbps,
      uploadMbps: args.uploadMbps,
      burstDownloadMbps: args.burstDownloadMbps,
      burstUploadMbps: args.burstUploadMbps,
      burstThresholdMbps: args.burstThresholdMbps,
      burstTimeSeconds: args.burstTimeSeconds,
      status: "draft" as PolicyTemplateStatus,
      description: args.description,
      createdBy: user._id,
      createdAt: now,
      updatedAt: now,
    });

    await logAudit(ctx, {
      action: "policyTemplate.versionCreated",
      entityTable: "policyTemplates",
      entityId: templateId,
      changedBy: user._id,
      after: { code: args.code, version: newVersion },
    });

    return templateId;
  },
});

/**
 * Publish a draft version. The version is frozen after this: its content
 * fields can no longer be changed. This is the core guarantee that tenants
 * provisioned against an older published version keep their behavior.
 */
export const publishPolicyTemplate = mutation({
  args: { templateId: v.id("policyTemplates") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Policy template not found");
    if (isPolicyVersionFrozen(template.status)) {
      throw new Error(
        `Version is ${template.status} and can no longer be published`,
      );
    }

    await ctx.db.patch(args.templateId, {
      status: "published" as PolicyTemplateStatus,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "policyTemplate.published",
      entityTable: "policyTemplates",
      entityId: args.templateId,
      changedBy: user._id,
      after: { status: "published" },
    });
  },
});

/**
 * Update a draft version's rate-limit fields. Frozen (published/retired)
 * versions are rejected. platform_super_admin or platform_ops only.
 */
export const updatePolicyTemplate = mutation({
  args: {
    templateId: v.id("policyTemplates"),
    name: v.optional(v.string()),
    downloadMbps: v.optional(v.number()),
    uploadMbps: v.optional(v.number()),
    burstDownloadMbps: v.optional(v.number()),
    burstUploadMbps: v.optional(v.number()),
    burstThresholdMbps: v.optional(v.number()),
    burstTimeSeconds: v.optional(v.number()),
    description: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, [
      "platform_super_admin",
      "platform_ops",
    ]);

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Policy template not found");
    if (isPolicyVersionFrozen(template.status)) {
      throw new Error(
        `Version is ${template.status} and can no longer be edited`,
      );
    }

    if (args.name !== undefined && !isValidPolicyTemplateName(args.name)) {
      throw new Error("Name must be 3-80 characters");
    }
    if (args.downloadMbps !== undefined && !isValidRateMbps(args.downloadMbps)) {
      throw new Error("downloadMbps must be a positive number ≤ 1,000,000");
    }
    if (args.uploadMbps !== undefined && !isValidRateMbps(args.uploadMbps)) {
      throw new Error("uploadMbps must be a positive number ≤ 1,000,000");
    }
    if (args.burstDownloadMbps !== undefined && !isValidBurstMbps(args.burstDownloadMbps)) {
      throw new Error("burstDownloadMbps must be 0–1,000,000 when provided");
    }
    if (args.burstUploadMbps !== undefined && !isValidBurstMbps(args.burstUploadMbps)) {
      throw new Error("burstUploadMbps must be 0–1,000,000 when provided");
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    if (args.name !== undefined) patch.name = args.name;
    if (args.downloadMbps !== undefined) patch.downloadMbps = args.downloadMbps;
    if (args.uploadMbps !== undefined) patch.uploadMbps = args.uploadMbps;
    if (args.burstDownloadMbps !== undefined) patch.burstDownloadMbps = args.burstDownloadMbps;
    if (args.burstUploadMbps !== undefined) patch.burstUploadMbps = args.burstUploadMbps;
    if (args.burstThresholdMbps !== undefined) patch.burstThresholdMbps = args.burstThresholdMbps;
    if (args.burstTimeSeconds !== undefined) patch.burstTimeSeconds = args.burstTimeSeconds;
    if (args.description !== undefined) patch.description = args.description;

    await ctx.db.patch(args.templateId, patch);

    await logAudit(ctx, {
      action: "policyTemplate.updated",
      entityTable: "policyTemplates",
      entityId: args.templateId,
      changedBy: user._id,
      after: {
        name: args.name,
        downloadMbps: args.downloadMbps,
        uploadMbps: args.uploadMbps,
      },
    });
  },
});

/**
 * Retire a published version. This is a terminal lifecycle transition; the
 * version remains frozen for tenants already provisioned against it. Only
 * platform_super_admin may retire — safety guard consistent with B3.
 */
export const retirePolicyTemplate = mutation({
  args: { templateId: v.id("policyTemplates") },
  handler: async (ctx, args) => {
    const user = await requirePlatformSubRole(ctx, ["platform_super_admin"]);

    const template = await ctx.db.get(args.templateId);
    if (!template) throw new Error("Policy template not found");
    if (template.status !== "published") {
      throw new Error("Only published versions may be retired");
    }

    await ctx.db.patch(args.templateId, {
      status: "retired" as PolicyTemplateStatus,
      updatedAt: Date.now(),
    });

    await logAudit(ctx, {
      action: "policyTemplate.retired",
      entityTable: "policyTemplates",
      entityId: args.templateId,
      changedBy: user._id,
      after: { status: "retired" },
    });
  },
});