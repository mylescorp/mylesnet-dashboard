import { v } from "convex/values";
import { MutationCtx, action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { hasPermission, hasPlatformSubRole, isPlatformUser, requirePermission, requirePlatformSubRole, requirePlatformUser, resolveRoles } from "./lib/auth";
import { assertMfaCompliance, isMfaCompliant } from "./lib/mfa";
import { tenantRoleHasPermission } from "./lib/permissions";
import { PLATFORM_FINANCE_SUB_ROLES } from "./lib/platformAccess";
import { logAudit } from "./lib/auditLog";
import { dayOf, monthOf } from "./lib/finance";
import { canTenantOperate, enforceTenantOnResource, readScopedTenant } from "./lib/tenant";
import { readTenantFilter } from "./lib/tenantIsolationCore";
import { organizationIdFromWorkosIdentity } from "./lib/workosIdentity";
import type { Id } from "./_generated/dataModel";

/**
 * Scheduled reports (spec §29). Definitions are user-managed; the crons job
 * calls `triggerDueReports` which generates the artifact (CSV/PDF bytes via
 * _storage) and logs a `reportExports` row. Manual "generate now" runs the
 * same action.
 *
 * Definitions and exports are tenant-owned. A tenant reader sees only rows
 * carrying their active tenant id; a Platform control-plane reader sees all.
 * A tenant write may only touch a report that its tenant owns. An unscoped
 * (legacy) report is never writable from a tenant.
 */

export type ReportDataset = "revenue" | "subscribers" | "financials";

/**
 * Platform sub-roles allowed to read unscoped (cross-tenant) reporting data.
 * From the module register row J4 (scheduled reports): SA CRUD, FIN CRUD
 * billing reports. A missing tenant owner is never permission to read across
 * tenants; the caller must prove one of these roles first.
 */
const REPORT_PLATFORM_SUB_ROLES: string[] = PLATFORM_FINANCE_SUB_ROLES;

export const listScheduledReports = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "reports:generate");
    const scope = await readScopedTenant(ctx);
    const tenantId = readTenantFilter(scope);
    if (!tenantId) {
      // Cross-tenant read: explicit platform sub-role gate.
      await requirePlatformSubRole(ctx, REPORT_PLATFORM_SUB_ROLES);
    }
    const rows = tenantId
      ? await ctx.db
          .query("scheduledReports")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
          .collect()
      : await ctx.db.query("scheduledReports").collect();
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listReportExports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "reports:read");
    const limit = args.limit ?? 50;
    const scope = await readScopedTenant(ctx);
    const tenantId = readTenantFilter(scope);
    if (!tenantId) {
      // Cross-tenant read: explicit platform sub-role gate.
      await requirePlatformSubRole(ctx, REPORT_PLATFORM_SUB_ROLES);
    }
    const rows = tenantId
      ? await ctx.db
          .query("reportExports")
          .withIndex("by_tenant_created", (q) => q.eq("tenantId", tenantId))
          .order("desc")
          .take(limit)
      : await ctx.db.query("reportExports").order("desc").take(limit);
    return rows.sort((a, b) => b.createdAt - a.createdAt);
  },
});

export const createScheduledReport = mutation({
  args: {
    name: v.string(),
    reportType: v.union(v.literal("daily_digest"), v.literal("investor"), v.literal("custom_analytics")),
    recipients: v.array(v.string()),
    frequency: v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly")),
    scopeFilter: v.optional(v.any()),
    format: v.union(v.literal("pdf"), v.literal("csv")),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "reports:generate");
    const scope = await readScopedTenant(ctx);
    const id = await ctx.db.insert("scheduledReports", {
      tenantId: readTenantFilter(scope) ?? undefined,
      name: args.name,
      reportType: args.reportType,
      recipients: args.recipients,
      frequency: args.frequency,
      scopeFilter: args.scopeFilter,
      format: args.format,
      enabled: true,
      createdBy: user._id,
      createdAt: Date.now(),
    });
    await logAudit(ctx, { action: "report.create", entityTable: "scheduledReports", entityId: id, changedBy: user._id, tenantId: scope.tenantId, after: args });
    return id;
  },
});

export const updateScheduledReport = mutation({
  args: {
    reportId: v.id("scheduledReports"),
    name: v.optional(v.string()),
    recipients: v.optional(v.array(v.string())),
    frequency: v.optional(v.union(v.literal("daily"), v.literal("weekly"), v.literal("monthly"))),
    scopeFilter: v.optional(v.any()),
    format: v.optional(v.union(v.literal("pdf"), v.literal("csv"))),
    enabled: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "reports:generate");
    const existing = await enforceTenantOnResource(ctx, await ctx.db.get(args.reportId), "scheduled report");
    if (!existing) throw new Error("Scheduled report not found");
    const patch = { name: args.name, recipients: args.recipients, frequency: args.frequency, scopeFilter: args.scopeFilter, format: args.format, enabled: args.enabled };
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    await ctx.db.patch(args.reportId, cleaned);
    await logAudit(ctx, { action: "report.update", entityTable: "scheduledReports", entityId: args.reportId, changedBy: user._id, tenantId: existing?.tenantId, after: cleaned });
  },
});

export const deleteScheduledReport = mutation({
  args: { reportId: v.id("scheduledReports") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "reports:generate");
    const report = await enforceTenantOnResource(ctx, await ctx.db.get(args.reportId), "scheduled report");
    if (!report) throw new Error("Scheduled report not found");
    await ctx.db.delete(args.reportId);
    await logAudit(ctx, { action: "report.delete", entityTable: "scheduledReports", entityId: args.reportId, changedBy: user._id, tenantId: report?.tenantId });
  },
});

function toCsv(header: string[], rows: (string | number | undefined)[][]): string {
  const escape = (value: string | number | undefined) => {
    if (value === undefined) return "";
    const s = String(value);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [header.map(escape).join(","), ...rows.map((row) => row.map(escape).join(","))].join("\n");
}

/** First day of the month after `month` ("yyyy-mm"), used to bound date-range reads. */
function nextMonthStart(month: string): string {
  const [year, monthIndex] = month.split("-").map(Number);
  const nextYear = monthIndex === 12 ? year + 1 : year;
  const nextMonth = monthIndex === 12 ? 1 : monthIndex + 1;
  return `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
}

/**
 * Build rows for a dataset. Runs inside actions via runQuery.
 *
 * When `tenantId` is supplied the rows are restricted to that tenant. An
 * unscoped (platform-wide) read is allowed only when the caller explicitly
 * passes `platformWide: true` after proving a reporting platform sub-role;
 * a missing tenant owner is never permission to read every tenant, so an
 * unscoped call without that flag fails closed.
 */
export const collectReportRows = internalQuery({
  args: {
    dataset: v.string(),
    month: v.optional(v.string()),
    tenantId: v.optional(v.id("tenants")),
    platformWide: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const month = args.month ?? monthOf(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tenantId = args.tenantId;
    const platformWide = args.platformWide === true;
    if (tenantId === undefined && !platformWide) {
      throw new Error("Unauthorized: unscoped report data requires platform authorization");
    }
    const ym = month.slice(0, 7);
    const monthStart = `${ym}-01`;
    const monthEnd = nextMonthStart(ym);
    switch (args.dataset) {
      case "revenue": {
        const snapshots = tenantId
          ? await ctx.db
              .query("dailySnapshots")
              .withIndex("by_tenant_date", (q) => q.eq("tenantId", tenantId).gte("date", monthStart).lt("date", monthEnd))
              .collect()
          : await ctx.db
              .query("dailySnapshots")
              .withIndex("by_date", (q) => q.lte("date", dayOf(Date.now())))
              .collect();
        return {
          header: ["date", "marketId", "revenueLocal", "revenueUSD", "salesCount", "newSubscribers", "netContributionLocal", "currency"],
          rows: snapshots
            .filter((s) => s.date.startsWith(ym))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => [s.date, s.marketId, s.revenueLocal, s.revenueUSD, s.salesCount, s.newSubscribers, s.netContributionLocal, s.currency]),
        };
      }
      case "subscribers": {
        const subs = tenantId
          ? await ctx.db
              .query("subscriberSnapshots")
              .withIndex("by_tenant_date", (q) => q.eq("tenantId", tenantId).gte("date", monthStart).lt("date", monthEnd))
              .collect()
          : await ctx.db.query("subscriberSnapshots").collect();
        return {
          header: ["date", "marketId", "activeCount", "newCount", "renewalCount", "renewalRate", "avgPlanPriceLocal", "currency"],
          rows: subs
            .filter((s) => s.date.startsWith(ym))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => [s.date, s.marketId, s.activeCount, s.newCount, s.renewalCount, s.renewalRate?.toFixed(3), s.avgPlanPriceLocal, s.currency]),
        };
      }
      case "financials": {
        const fin = tenantId
          ? await ctx.db
              .query("marketFinancials")
              .withIndex("by_tenant_month", (q) => q.eq("tenantId", tenantId).eq("month", ym))
              .collect()
          : await ctx.db.query("marketFinancials").withIndex("by_month", (q) => q.eq("month", ym)).collect();
        const exp = tenantId
          ? await ctx.db
              .query("expenses")
              .withIndex("by_tenant_month", (q) => q.eq("tenantId", tenantId).eq("month", ym))
              .collect()
          : await ctx.db.query("expenses").withIndex("by_month", (q) => q.eq("month", ym)).collect();
        return {
          header: ["marketId", "revenueLocal", "revenueUSD", "variableCostLocal", "netContributionLocal", "breakEvenStatus", "expenseCount"],
          rows: fin.map((f) => [
            f.marketId,
            f.revenueLocal,
            f.revenueUSD,
            f.variableCostLocal,
            f.netContributionLocal,
            f.breakEvenStatus,
            exp.filter((e) => e.marketId === f.marketId).length,
          ]),
        };
      }
      default:
        return { header: [], rows: [] };
    }
  },
});

/**
 * Resolve the active tenant for a caller-supplied WorkOS organization id,
 * validated by that user's active membership and the `reports:generate`
 * permission. Actions cannot read the database directly, so `generateReport`
 * hands the already-verified user id and the organization claim from its own
 * identity to this internal query. An unmapped organization, a suspended
 * tenant, an inactive membership, or a role without the permission yields null;
 * the caller must then prove it is a Platform control-plane reader before any
 * unscoped read, so a denied tenant caller can never fall through to
 * cross-tenant data.
 */
export const resolveCallerTenant = internalQuery({
  args: { userId: v.id("users"), organizationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.organizationId) return null;
    // A removed or deactivated account must not keep exporting tenant data just
    // because its membership row was left in place when the account changed.
    const user = await ctx.db.get(args.userId);
    if (
      !user ||
      user.isActive === false ||
      user.deactivatedAt !== undefined ||
      user.deletedAt !== undefined
    ) {
      return null;
    }
    const tenant = await ctx.db
      .query("tenants")
      .withIndex("by_workosOrganizationId", (q) => q.eq("workosOrganizationId", args.organizationId!))
      .first();
    if (!tenant || !canTenantOperate(tenant.status)) return null;
    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", args.userId).eq("tenantId", tenant._id))
      .first();
    if (!membership || membership.status !== "active") return null;
    if (!tenantRoleHasPermission(membership.role, "reports:generate")) return null;
    return tenant._id;
  },
});

/**
 * Whether the caller may read platform-wide (unscoped) report data. Only an
 * explicit reporting platform sub-role holding the `reports:generate`
 * permission and an MFA-enrolled platform identity qualifies, so an unresolved
 * or denied tenant caller fails closed and a generic platform permission never
 * substitutes for the sub-role gate. This is only consulted for the
 * platform-wide path; tenant-scoped reads use `canReadTenantReports`.
 */
export const canReadPlatformReports = internalQuery({
  args: { userId: v.id("users") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (
      !user ||
      user.isActive === false ||
      user.deactivatedAt !== undefined ||
      user.deletedAt !== undefined
    ) {
      return false;
    }
    const roles = await resolveRoles(ctx, user);
    return (
      isPlatformUser(roles) &&
      hasPermission(roles, "reports:generate") &&
      hasPlatformSubRole(roles, REPORT_PLATFORM_SUB_ROLES) &&
      isMfaCompliant(roles.map((role) => role.slug), user)
    );
  },
});

/**
 * Whether the caller may read a specific tenant's report data: an active
 * account with an active membership of that operable tenant holding
 * `reports:generate`. Used to authorize a scheduled export before any artifact
 * is generated, so a revoked creator leaves nothing behind.
 */
export const canReadTenantReports = internalQuery({
  args: { userId: v.id("users"), tenantId: v.id("tenants") },
  handler: async (ctx, args) => {
    const user = await ctx.db.get(args.userId);
    if (
      !user ||
      user.isActive === false ||
      user.deactivatedAt !== undefined ||
      user.deletedAt !== undefined
    ) {
      return false;
    }
    const tenant = await ctx.db.get(args.tenantId);
    if (!tenant || !canTenantOperate(tenant.status)) return false;
    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) =>
        q.eq("userId", args.userId).eq("tenantId", args.tenantId),
      )
      .first();
    return Boolean(
      membership &&
        membership.status === "active" &&
        tenantRoleHasPermission(membership.role, "reports:generate"),
    );
  },
});

/** Generate one report artifact now (manual or scheduled). */
export const generateReport = action({
  args: {
    scheduledReportId: v.optional(v.id("scheduledReports")),
    dataset: v.string(),
    format: v.union(v.literal("pdf"), v.literal("csv")),
    scopeFilter: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<{ exportId: string }> => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Unauthenticated");
    const reporter = (await ctx.runQuery(internal.platformUsers.getUserByEmail, {
      email: identity.email ?? "",
    })) as { _id: Id<"users"> } | null;
    if (!reporter) throw new Error("Unauthorized");

    const tenantId = await ctx.runQuery(internal.scheduledReports.resolveCallerTenant, {
      userId: reporter._id,
      organizationId: organizationIdFromWorkosIdentity(identity),
    });

    // An unresolved tenant is only ever allowed through as an explicit Platform
    // control-plane reader; a denied tenant caller must never read every tenant.
    if (!tenantId) {
      const platformWide = await ctx.runQuery(internal.scheduledReports.canReadPlatformReports, {
        userId: reporter._id,
      });
      if (!platformWide) {
        throw new Error("Unauthorized: report generation requires platform access or an active tenant membership");
      }
    }

    const data = await ctx.runQuery(internal.scheduledReports.collectReportRows, {
      dataset: args.dataset,
      month: args.scopeFilter?.month,
      tenantId: tenantId ?? undefined,
      // The platform-wide path above already proved the reporting sub-role.
      platformWide: tenantId ? false : true,
    });

    let fileId: Id<"_storage">;
    if (args.format === "csv") {
      const csv = toCsv(data.header, data.rows);
      const blob = new Blob([csv], { type: "text/csv" });
      fileId = await ctx.storage.store(blob);
    } else {
      // PDF: minimal, dependency-free HTML snapshot rendered to a stored blob.
      const html = `<html><body><h1>${args.dataset} report</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
      const blob = new Blob([html], { type: "text/html" });
      fileId = await ctx.storage.store(blob);
    }

    let exportId: string;
    try {
      exportId = await ctx.runMutation(internal.scheduledReports.recordExport, {
        scheduledReportId: args.scheduledReportId,
        requestedBy: reporter._id,
        format: args.format,
        scopeFilter: args.scopeFilter,
        dataset: args.dataset,
        fileId,
        tenantId: tenantId ?? undefined,
      });
    } catch (error) {
      // The writer re-checks access; drop the just-stored artifact if it
      // rejects so the failed export leaves no orphaned file behind.
      await ctx.storage.delete(fileId);
      throw error;
    }
    return { exportId };
  },
});

/**
 * Prove, inside the writer, that the exporting operator may create a report
 * export before any row is written. A tenant export needs an operable tenant
 * and an active membership of it holding `reports:generate`; an unscoped export
 * needs the reporting platform sub-role plus MFA. This re-checks
 * `generateReport`'s admission at the writer so the authorization never depends
 * on every caller.
 *
 * The check verifies: active account, then active tenant membership with
 * `reports:generate` when a tenant is in scope, then platform sub-role with
 * `reports:generate` and MFA for the platform-wide path. All other paths throw.
 */
async function requireReportExportActor(
  ctx: MutationCtx,
  userId: Id<"users">,
  tenantId: Id<"tenants"> | undefined,
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (
    !user ||
    user.isActive === false ||
    user.deactivatedAt !== undefined ||
    user.deletedAt !== undefined
  ) {
    throw new Error("Unauthorized: report export requires an active account");
  }
  if (tenantId) {
    const tenant = await ctx.db.get(tenantId);
    const membership = await ctx.db
      .query("tenantMemberships")
      .withIndex("by_user_tenant", (q) => q.eq("userId", userId).eq("tenantId", tenantId))
      .first();
    if (
      tenant &&
      canTenantOperate(tenant.status) &&
      membership &&
      membership.status === "active" &&
      tenantRoleHasPermission(membership.role, "reports:generate")
    ) {
      return;
    }
  }
  const roles = await resolveRoles(ctx, user);
  if (
    isPlatformUser(roles) &&
    hasPermission(roles, "reports:generate") &&
    hasPlatformSubRole(roles, REPORT_PLATFORM_SUB_ROLES)
  ) {
    // Platform-wide (cross-tenant) export: mandatory MFA applies.
    assertMfaCompliance(user, roles.map((role) => role.slug));
    return;
  }
  throw new Error("Unauthorized: report export requires tenant or platform report access");
}

export const recordExport = internalMutation({
  args: {
    scheduledReportId: v.optional(v.id("scheduledReports")),
    requestedBy: v.id("users"),
    format: v.union(v.literal("pdf"), v.literal("csv")),
    scopeFilter: v.optional(v.any()),
    dataset: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
    tenantId: v.optional(v.id("tenants")),
  },
  handler: async (ctx, args) => {
    // Authorization first: the writer never relies on its callers to have
    // checked access before it inserts.
    await requireReportExportActor(ctx, args.requestedBy, args.tenantId);
    const id = await ctx.db.insert("reportExports", {
      tenantId: args.tenantId,
      scheduledReportId: args.scheduledReportId,
      requestedBy: args.requestedBy,
      format: args.format,
      scopeFilter: args.scopeFilter,
      dataset: args.dataset,
      fileId: args.fileId,
      status: "ready",
      generatedAt: Date.now(),
      createdAt: Date.now(),
    });
    await logAudit(ctx, {
      action: "report.export",
      entityTable: "reportExports",
      entityId: id,
      changedBy: args.requestedBy,
      tenantId: args.tenantId ?? null,
      after: { dataset: args.dataset, format: args.format },
    });
    return id;
  },
});

export const markReportExportViewed = mutation({
  args: { exportId: v.id("reportExports") },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    await ctx.db.patch(args.exportId, { viewedAt: Date.now() });
  },
});

/** Cron entrypoint: run due scheduled reports. */
export const triggerDueReports = internalAction({
  args: {},
  handler: async (ctx): Promise<{ generated: string[] }> => {
    const now = new Date();
    const reports = await ctx.runQuery(internal.scheduledReports.getDueReports, {
      day: now.getDay(),
      date: now.getDate(),
    });
    // getDueReports returns enabled reports that frequencyDue matches; the
    // internal query re-encodes the rule so actions stay pure.
    const generated: string[] = [];
    for (const report of reports) {
      const dataset =
        report.reportType === "daily_digest"
          ? "revenue"
          : report.reportType === "investor"
            ? "financials"
            : "revenue";
      try {
        // Verify the creator's access BEFORE reading data or storing a file: a
        // scheduled report without a tenant is platform-wide and needs the
        // reporting sub-role, while a tenant report needs an active membership.
        // A missing owner is never permission to read every tenant, and a
        // revoked creator must not leave an orphaned artifact behind.
        const authorized =
          report.tenantId === undefined
            ? await ctx.runQuery(internal.scheduledReports.canReadPlatformReports, {
                userId: report.createdBy,
              })
            : await ctx.runQuery(internal.scheduledReports.canReadTenantReports, {
                userId: report.createdBy,
                tenantId: report.tenantId,
              });
        if (!authorized) continue;
        const data = await ctx.runQuery(internal.scheduledReports.collectReportRows, {
          dataset,
          month: now.toISOString().slice(0, 7),
          tenantId: report.tenantId,
          platformWide: report.tenantId === undefined,
        });
        const blob = new Blob([toCsv(data.header, data.rows)], { type: "text/csv" });
        const fileId = await ctx.storage.store(blob);
        try {
          await ctx.runMutation(internal.scheduledReports.recordExport, {
            scheduledReportId: report._id,
            requestedBy: report.createdBy,
            format: "csv",
            scopeFilter: report.scopeFilter,
            dataset,
            fileId,
            tenantId: report.tenantId,
          });
        } catch (error) {
          // The writer re-checks access; if it still rejects, drop the file that
          // will never be referenced so a repeated daily run cannot accumulate
          // orphaned artifacts.
          await ctx.storage.delete(fileId);
          throw error;
        }
        await ctx.runMutation(internal.scheduledReports.touchLastRun, { reportId: report._id });
        generated.push(report.name);
      } catch {
        // A single scheduled report failing must not kill the whole sweep.
      }
    }
    return { generated };
  },
});

export const getDueReports = internalQuery({
  args: { day: v.number(), date: v.number() },
  handler: async (ctx, args) => {
    const all = await ctx.db.query("scheduledReports").withIndex("by_enabled", (q) => q.eq("enabled", true)).collect();
    return all.filter((r) => {
      if (r.frequency === "daily") return true;
      if (r.frequency === "weekly") return args.day === 6;
      return args.date === 1;
    });
  },
});

export const touchLastRun = internalMutation({
  args: { reportId: v.id("scheduledReports") },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.reportId, { lastRunAt: Date.now() });
  },
});
