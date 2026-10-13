import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { paginationOptsValidator } from "convex/server";
import type { Doc } from "./_generated/dataModel";
import { Id } from "./_generated/dataModel";
import { listAuditLog as readAuditLog, logAudit } from "./lib/auditLog";
import { AUDIT_CHAIN_VERIFY_RUN_ID } from "./auditChainVerify";
import { verifyPaymentCredentialAttestation } from "./lib/paymentCredentialAttestation";
import { credentialRotationRequestState } from "./lib/paymentCredentialRotationCore";
import {
  isPlatformUser,
  permissionsOf,
  requirePlatformUser,
  requirePlatformSubRole,
  resolveRoles,
  resolveTenantAccess,
  resolveUserByIdentity,
  tenantRoleAsResolvedRole,
} from "./lib/auth";


const PAYMENT_GATEWAY_MANAGERS = ["platform_super_admin", "platform_owner"];
const PAYMENT_GATEWAY_PUBLIC_EDITORS = ["platform_super_admin", "platform_owner", "platform_finance"];
const PAYMENT_GATEWAY_PAGE_SIZE = 50;
const PAYMENT_GATEWAY_ROTATION_LEASE_MS = 5 * 60 * 1000;

function projectPaymentGateway(row: Doc<"platformPaymentGatewayConfigs">, tenantName: string | null = null) {
  return { _id: row._id, tenantId: row.tenantId, tenantName, environment: row.environment, shortCode: row.shortCode, enabled: row.enabled, credentialsConfigured: row.secretVersionId !== undefined, rotationPending: row.rotationOperationId !== undefined, rotationLeaseExpiresAt: row.rotationStartedAt === undefined ? null : row.rotationStartedAt + PAYMENT_GATEWAY_ROTATION_LEASE_MS, createdAt: row.createdAt, updatedAt: row.updatedAt, deletedAt: row.deletedAt ?? null };
}
function validateDarajaShortCode(value: string): string {
  const shortCode = value.trim();
  if (!/^\d{5,6}$/.test(shortCode)) throw new Error("Enter a valid 5- or 6-digit business short code.");
  return shortCode;
}
function validatePaymentGatewayVersion(value: string): string {
  if (!/^[A-Za-z0-9-]{32,64}$/.test(value)) throw new Error("The credential update could not be confirmed.");
  return value;
}
function validateRotationOperationId(value: string): string {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new Error("The credential update request is invalid.");
  return value;
}

/**
 * Returns the current authenticated platform user's role, permissions and
 * profile, or null if they are not signed in at all. Used by the layout guard
 * to decide whether to show the panel, bounce to /signin, or show /unauthorized.
 */
export const getCurrentPlatformUser = query({
  args: {},
  handler: async (ctx) => {
    const user = await resolveUserByIdentity(ctx);
    if (!user) return null;

    const platformRoles = await resolveRoles(ctx, user);
    // A tenant administrator is provisioned with a `tenantMemberships` row and
    // no platform role, so their tenant role must be folded into the principal
    // here. Without this the tenant panel evaluates as an empty principal and
    // every permission-gated control disappears.
    const tenantAccess = await resolveTenantAccess(ctx, user);
    const roles = tenantAccess
      ? [...platformRoles, tenantRoleAsResolvedRole(tenantAccess.role)]
      : platformRoles;
    const permissions = permissionsOf(platformRoles);
    for (const permission of tenantAccess?.permissions ?? []) {
      if (!permissions.includes(permission)) permissions.push(permission);
    }
    const primary = roles.slice().sort((left, right) => right.rank - left.rank)[0] ?? null;

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      image: user.image,
      // A remote image is only rendered by the client when this Convex
      // storage reference is present. WorkOS profile image URLs are treated
      // as untrusted display data and fall back to initials instead.
      avatarStorageId: user.avatarStorageId ?? null,
      jobTitle: user.jobTitle,
      platformRole: user.platformRole ?? null,
      tenantRole: tenantAccess?.role ?? null,
      tenantId: tenantAccess?.tenantId ?? null,
      isPlatform: isPlatformUser(platformRoles),
      canViewRevenue: roles.some((role) => role.permissions.includes("revenue:view")),
      mfaEnrolled: user.mfaEnrolled === true,
      permissions,
      roles: roles.map((role) => ({
        _id: role._id ?? undefined,
        slug: role.slug,
        name: role.name,
        isPlatform: role.isPlatform,
        rank: role.rank,
      })),
      primaryRole:
        primary !== null
          ? { slug: primary.slug, name: primary.name, isPlatform: primary.isPlatform }
          : null,
    };
  },
});

/** Read-only, paginated audit log view for /platform/audit-log. */
export const listAuditLog = query({
  args: {
    entityTable: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const limit = Math.min(100, args.limit ?? 50);
    const base = ctx.db.query("auditLog");
    if (args.entityTable) {
      return (
        await ctx.db
          .query("auditLog")
          .withIndex("by_entity", (q) => q.eq("entityTable", args.entityTable!))
          .order("desc")
          .take(limit)
      );
    }
    return (
      await base.order("desc").take(limit)
    );
  },
});

/** Single append-only audit record for the canonical detail route. */
export const getAuditLogEntry = query({
  args: { auditId: v.id("auditLog") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return await ctx.db.get(args.auditId);
  },
});

/** Read-only, paginated audit log view for /platform/audit. */
export const listAuditLogPage = query({
  args: {
    entityTable: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.nullable(v.string())),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    return readAuditLog(ctx, {
      entityTable: args.entityTable,
      limit: args.limit,
      cursor: args.cursor ?? null,
    });
  },
});

/**
 * Report the state of the background audit-chain verification sweep — a low
 * constant-cost read of the canonical `migrationRuns` row the sweep updates.
 * The sweep itself (see `auditChainVerify.ts`) verifies every sealed row from
 * the genesis sentinel forward; this query only reports its status, coverage
 * range and completion time so the UI can label the result honestly without
 * re-walking the chain. Rows written before L2 remain readable but
 * intentionally have no integrity hash.
 */
export const getAuditChainHealth = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const run = await ctx.db
      .query("migrationRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", AUDIT_CHAIN_VERIFY_RUN_ID))
      .first();
    if (run === null) {
      return {
        status: "never",
        valid: false,
        issue: null,
        checkedEntries: 0,
        firstSequence: null,
        lastSequence: null,
        startsAt: null,
        endsAt: null,
        legacySkipped: 0,
        runningSince: null,
        completedAt: null,
        lastGoodAt: null,
      };
    }

    const manifest = (run.manifest ?? {}) as Record<string, unknown>;
    const issue = typeof manifest.issue === "string" ? (manifest.issue as string) : null;
    const lastGoodAt = typeof manifest.lastCompletedAt === "number" ? manifest.lastCompletedAt : null;
    const lastSummary = (manifest.lastSummary ?? null) as Record<string, unknown> | null;
    const numberField = (value: unknown): number | null => (typeof value === "number" ? value : null);

    // `running` exposes the in-progress sweep's progress plus the last clean
    // completion; `completed`/`failed` describe the latest attempt outright.
    const described = run.status === "running"
      ? { checkedEntries: Math.max(run.rowsProcessed, 0), firstSequence: numberField(manifest.firstSequence), lastSequence: numberField(manifest.lastSequence), startsAt: numberField(manifest.startsAt), endsAt: numberField(manifest.endsAt), legacySkipped: numberField(manifest.legacySkipped) ?? 0, valid: lastSummary !== null, completedAt: null }
      : { checkedEntries: Math.max(run.rowsProcessed, 0), firstSequence: numberField(manifest.firstSequence), lastSequence: numberField(manifest.lastSequence), startsAt: numberField(manifest.startsAt), endsAt: numberField(manifest.endsAt), legacySkipped: numberField(manifest.legacySkipped) ?? 0, valid: issue === null, completedAt: run.completedAt ?? null };

    return {
      status: run.status,
      valid: described.valid,
      issue: run.status === "running" ? null : issue,
      checkedEntries: described.checkedEntries,
      firstSequence: described.firstSequence,
      lastSequence: described.lastSequence,
      startsAt: described.startsAt,
      endsAt: described.endsAt,
      legacySkipped: described.legacySkipped,
      runningSince: run.status === "running" ? (run.startedAt ?? null) : null,
      completedAt: described.completedAt,
      lastGoodAt,
    };
  },
});

/**
 * Single platform-security snapshot for /platform/security: tenant identity
 * coverage, staff MFA posture, WorkOS webhook queue + delivery health, and
 * current feature-flag states. All counts are bounded to small reads.
 */
export const getPlatformSecurityOverview = query({
  args: {},
  handler: async (ctx) => {
    const actor = await requirePlatformUser(ctx);
    const [tenants, users, roles, workosEvents, deliveries, featureFlagRows] = await Promise.all([
      ctx.db.query("tenants").collect(),
      ctx.db.query("users").collect(),
      ctx.db.query("roles").collect(),
      ctx.db.query("workosWebhookEvents").collect(),
      ctx.db.query("webhookDeliveryLog").withIndex("by_receivedAt").order("desc").take(300),
      ctx.db.query("featureFlags").collect(),
    ]);

    const staff: Array<{
      userId: Id<"users">;
      name: string | null;
      email: string | null;
      roles: string[];
      mfaOptional: true;
      mfaEnrolled: boolean;
      mfaEnrolledAt: number | null;
      status: "enrolled" | "not_enrolled";
    }> = [];
    for (const user of users) {
      if (user.deletedAt !== undefined) continue;
      const resolved = await resolveRoles(ctx, user);
      if (!isPlatformUser(resolved)) continue;
      const enrolled = user.mfaEnrolled === true;
      staff.push({
        userId: user._id,
        name: user.name ?? null,
        email: user.email ?? null,
        roles: resolved.map((role) => role.slug),
        mfaOptional: true,
        mfaEnrolled: enrolled,
        mfaEnrolledAt: user.mfaEnrolledAt ?? null,
        status: enrolled ? "enrolled" : "not_enrolled",
      });
    }

    const eventStatusCounts = { received: 0, completed: 0, retry: 0, quarantined: 0 };
    for (const event of workosEvents) {
      if (event.status in eventStatusCounts) eventStatusCounts[event.status] += 1;
    }

    const now = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    const deliveries24h = deliveries.filter((delivery) => now - delivery.receivedAt <= dayMs);

    // The platform panel owns the featureFlags table. Do not read the legacy
    // system_settings booleans here: they neither represent percentage/
    // tenant rollouts nor reflect changes made through /platform/feature-flags.
    const featureFlags = Object.fromEntries(
      featureFlagRows.map((flag) => [flag.key, flag.enabled]),
    );

    return {
      tenantOverview: {
        total: tenants.length,
        active: tenants.filter((tenant) => tenant.status === "active").length,
        trial: tenants.filter((tenant) => tenant.status === "trial").length,
        suspended: tenants.filter((tenant) => tenant.status === "suspended").length,
        cancelled: tenants.filter((tenant) => tenant.status === "cancelled").length,
        identityMapped: tenants.filter((tenant) => tenant.workosOrganizationId !== undefined).length,
      },
      staff,
      staffMfaEnrolled: staff.filter((entry) => entry.mfaEnrolled).length,
      mfaMode: "optional" as const,
      workosEvents: eventStatusCounts,
      deliveries24h: {
        total: deliveries24h.length,
        processed: deliveries24h.filter((delivery) => delivery.processed).length,
        signatureInvalid: deliveries24h.filter((delivery) => !delivery.signatureValid).length,
      },
      featureFlags,
      currentUserId: actor._id,
    };
  },
});

/** Distinct entity types present in recent audit entries, for the /platform/audit filter. Bounded to a recent sample so the filter never drifts from what writers actually emit. */
export const listAuditEntityTables = query({
  args: {},
  handler: async (ctx) => {
    await requirePlatformUser(ctx);
    const recent = await ctx.db.query("auditLog").order("desc").take(2000);
    return Array.from(new Set(recent.map((entry) => entry.entityTable))).sort();
  },
});



/** Restricted platform directory for tenant-owned payment gateway metadata. Never returns secret references or values. */
export const recordPaymentGatewaySettingsView = mutation({
  args: {},
  handler: async (ctx) => {
    const actor = await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_PUBLIC_EDITORS);
    await logAudit(ctx, {
      action: "platform.paymentGateway.settingsViewed",
      entityTable: "platformPaymentGatewayConfigs",
      entityId: "directory",
      changedBy: actor._id,
      tenantId: null,
      after: { scope: "gateway_directory" },
    });
    return { recorded: true };
  },
});

export const listPaymentGatewayConfigs = query({
  args: { paginationOpts: paginationOptsValidator, includeArchived: v.optional(v.boolean()) },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_MANAGERS);
    const rows = args.includeArchived
      ? await ctx.db.query("platformPaymentGatewayConfigs").withIndex("by_updatedAt").order("desc").paginate({
        ...args.paginationOpts,
        numItems: Math.min(PAYMENT_GATEWAY_PAGE_SIZE, Math.max(1, Math.floor(args.paginationOpts.numItems))),
      })
      : await ctx.db.query("platformPaymentGatewayConfigs").withIndex("by_deletedAt_updatedAt", (q) => q.eq("deletedAt", undefined)).order("desc").paginate({
        ...args.paginationOpts,
        numItems: Math.min(PAYMENT_GATEWAY_PAGE_SIZE, Math.max(1, Math.floor(args.paginationOpts.numItems))),
      });
    return {
      ...rows,
      page: await Promise.all(rows.page.map(async (row) => {
        const tenant = await ctx.db.get(row.tenantId);
        return projectPaymentGateway(row, tenant?.deletedAt === undefined ? tenant?.name ?? null : null);
      })),
    };
  },
});

/** Restricted platform detail view. Secret values, references, and version identifiers are withheld. */
export const getPaymentGatewayConfig = query({
  args: { configId: v.id("platformPaymentGatewayConfigs") },
  handler: async (ctx, args) => {
    await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_MANAGERS);
    const row = await ctx.db.get(args.configId);
    const tenant = row ? await ctx.db.get(row.tenantId) : null;
    return row ? projectPaymentGateway(row, tenant?.deletedAt === undefined ? tenant?.name ?? null : null) : null;
  },
});

export const createPaymentGatewayConfig = mutation({
  args: {
    tenantId: v.id("tenants"),
    environment: v.union(v.literal("sandbox"), v.literal("production")),
    shortCode: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_MANAGERS);
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || tenant.deletedAt !== undefined) throw new Error("The selected workspace is unavailable.");
    const shortCode = validateDarajaShortCode(args.shortCode);
    const existing = await ctx.db.query("platformPaymentGatewayConfigs")
      .withIndex("by_tenant_provider", (q) => q.eq("tenantId", args.tenantId).eq("provider", "daraja"))
      .first();
    if (existing) throw new Error("Payment gateway settings already exist for this workspace.");
    const now = Date.now();
    const configId = await ctx.db.insert("platformPaymentGatewayConfigs", {
      tenantId: args.tenantId,
      provider: "daraja",
      environment: args.environment,
      shortCode,
      enabled: false,
      createdBy: actor._id,
      createdAt: now,
      updatedBy: actor._id,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "platform.paymentGateway.created",
      entityTable: "platformPaymentGatewayConfigs",
      entityId: configId,
      changedBy: actor._id,
      tenantId: args.tenantId,
      after: { provider: "daraja", environment: args.environment, shortCode, enabled: false },
    });
    return configId;
  },
});

/** Narrow public configuration edit. Secret fields cannot be passed to this function's validator. */
export const updatePaymentGatewayPublicFields = mutation({
  args: {
    tenantId: v.id("tenants"),
    environment: v.optional(v.union(v.literal("sandbox"), v.literal("production"))),
    shortCode: v.optional(v.string()),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_PUBLIC_EDITORS);
    const row = await ctx.db.query("platformPaymentGatewayConfigs")
      .withIndex("by_tenant_provider", (q) => q.eq("tenantId", args.tenantId).eq("provider", "daraja"))
      .first();
    if (!row || row.deletedAt !== undefined) throw new Error("Payment gateway settings are unavailable.");
    const shortCode = args.shortCode === undefined ? row.shortCode : validateDarajaShortCode(args.shortCode);
    const enabled = args.enabled ?? row.enabled;
    if (enabled && row.secretVersionId === undefined) throw new Error("Add credentials before enabling this gateway.");
    const next = {
      environment: args.environment ?? row.environment,
      shortCode,
      enabled,
    };
    const now = Date.now();
    await ctx.db.patch(row._id, { ...next, updatedBy: actor._id, updatedAt: now });
    await logAudit(ctx, {
      action: "platform.paymentGateway.updated",
      entityTable: "platformPaymentGatewayConfigs",
      entityId: row._id,
      changedBy: actor._id,
      tenantId: row.tenantId,
      before: { environment: row.environment, shortCode: row.shortCode, enabled: row.enabled },
      after: next,
    });
    return { updated: true };
  },
});

export const archivePaymentGatewayConfig = mutation({
  args: { configId: v.id("platformPaymentGatewayConfigs") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_MANAGERS);
    const row = await ctx.db.get(args.configId);
    if (!row || row.deletedAt !== undefined) throw new Error("Payment gateway settings are unavailable.");
    const now = Date.now();
    await ctx.db.patch(row._id, { enabled: false, deletedAt: now, deletedBy: actor._id, rotationOperationId: undefined, rotationStartedAt: undefined, updatedBy: actor._id, updatedAt: now });
    await logAudit(ctx, {
      action: "platform.paymentGateway.archived",
      entityTable: "platformPaymentGatewayConfigs",
      entityId: row._id,
      changedBy: actor._id,
      tenantId: row.tenantId,
      before: { enabled: row.enabled, archived: false },
      after: { enabled: false, archived: true },
    });
    return { archived: true };
  },
});

export const restorePaymentGatewayConfig = mutation({
  args: { configId: v.id("platformPaymentGatewayConfigs") },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_MANAGERS);
    const row = await ctx.db.get(args.configId);
    if (!row || row.deletedAt === undefined) throw new Error("Archived payment gateway settings were not found.");
    const now = Date.now();
    await ctx.db.patch(row._id, { enabled: false, deletedAt: undefined, deletedBy: undefined, rotationOperationId: undefined, rotationStartedAt: undefined, updatedBy: actor._id, updatedAt: now });
    await logAudit(ctx, {
      action: "platform.paymentGateway.restored",
      entityTable: "platformPaymentGatewayConfigs",
      entityId: row._id,
      changedBy: actor._id,
      tenantId: row.tenantId,
      before: { archived: true },
      after: { archived: false, enabled: false },
    });
    return { restored: true };
  },
});

/** Starts an idempotent, bounded credential rotation lease without receiving credential bytes. */
export const beginPaymentGatewayCredentialRotation = mutation({
  args: { configId: v.id("platformPaymentGatewayConfigs"), operationId: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_MANAGERS);
    const operationId = validateRotationOperationId(args.operationId);
    const row = await ctx.db.get(args.configId);
    if (!row || row.deletedAt !== undefined) throw new Error("Payment gateway settings are unavailable.");
    const now = Date.now();
    const requestState = credentialRotationRequestState({
      lease: { operationId: row.rotationOperationId, startedAt: row.rotationStartedAt },
      requestedOperationId: operationId,
      now,
      leaseDurationMs: PAYMENT_GATEWAY_ROTATION_LEASE_MS,
    });
    if (requestState === "blocked") throw new Error("A credential update is already in progress.");
    if (requestState === "resume") {
      await logAudit(ctx, {
        action: "platform.paymentGateway.rotationResumeRequested",
        entityTable: "platformPaymentGatewayConfigs",
        entityId: row._id,
        changedBy: actor._id,
        tenantId: row.tenantId,
        after: { rotationPending: true },
      });
      return { started: true, alreadyStarted: true };
    }
    await ctx.db.patch(row._id, { rotationOperationId: operationId, rotationStartedAt: now, updatedBy: actor._id, updatedAt: now });
    await logAudit(ctx, {
      action: "platform.paymentGateway.rotationStarted",
      entityTable: "platformPaymentGatewayConfigs",
      entityId: row._id,
      changedBy: actor._id,
      tenantId: row.tenantId,
      after: { credentialsConfigured: row.secretVersionId !== undefined, rotationPending: true },
    });
    return { started: true, alreadyStarted: false };
  },
});

export const completePaymentGatewayCredentialRotation = mutation({
  args: {
    configId: v.id("platformPaymentGatewayConfigs"),
    operationId: v.string(),
    versionId: v.string(),
    attestation: v.string(),
  },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_MANAGERS);
    const operationId = validateRotationOperationId(args.operationId);
    const versionId = validatePaymentGatewayVersion(args.versionId);
    if (!await verifyPaymentCredentialAttestation(args, process.env.PAYMENT_CREDENTIAL_ROTATION_ATTESTATION_KEY)) {
      throw new Error("The credential update could not be confirmed.");
    }
    const row = await ctx.db.get(args.configId);
    if (!row || row.deletedAt !== undefined || row.rotationOperationId !== operationId) {
      throw new Error("The credential update could not be confirmed.");
    }
    const now = Date.now();
    await ctx.db.patch(row._id, {
      secretVersionId: versionId,
      rotationOperationId: undefined,
      rotationStartedAt: undefined,
      updatedBy: actor._id,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "platform.paymentGateway.credentialsRotated",
      entityTable: "platformPaymentGatewayConfigs",
      entityId: row._id,
      changedBy: actor._id,
      tenantId: row.tenantId,
      before: { credentialsConfigured: row.secretVersionId !== undefined },
      after: { credentialsConfigured: true },
    });
    return { credentialsConfigured: true };
  },
});

export const failPaymentGatewayCredentialRotation = mutation({
  args: { configId: v.id("platformPaymentGatewayConfigs"), operationId: v.string() },
  handler: async (ctx, args) => {
    const actor = await requirePlatformSubRole(ctx, PAYMENT_GATEWAY_MANAGERS);
    const operationId = validateRotationOperationId(args.operationId);
    const row = await ctx.db.get(args.configId);
    if (!row || row.deletedAt !== undefined || row.rotationOperationId !== operationId) {
      await logAudit(ctx, {
        action: "platform.paymentGateway.rotationFailureIgnored",
        entityTable: "platformPaymentGatewayConfigs",
        entityId: args.configId,
        changedBy: actor._id,
        tenantId: row?.tenantId ?? null,
        after: { cleared: false },
      });
      return { cleared: false };
    }
    const now = Date.now();
    await ctx.db.patch(row._id, {
      rotationOperationId: undefined,
      rotationStartedAt: undefined,
      updatedBy: actor._id,
      updatedAt: now,
    });
    await logAudit(ctx, {
      action: "platform.paymentGateway.rotationFailed",
      entityTable: "platformPaymentGatewayConfigs",
      entityId: row._id,
      changedBy: actor._id,
      tenantId: row.tenantId,
      after: { credentialsConfigured: row.secretVersionId !== undefined, rotationPending: false },
    });
    return { cleared: true };
  },
});
