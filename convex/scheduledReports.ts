import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePermission, requirePlatformUser } from "./lib/auth";
import { logAudit } from "./lib/auditLog";
import { dayOf, monthOf } from "./lib/finance";
import { canTenantOperate, readScopedTenant } from "./lib/tenant";
import { decideTenantResourceWrite, readTenantFilter } from "./lib/tenantIsolationCore";
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

export const listScheduledReports = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "reports:generate");
    const scope = await readScopedTenant(ctx);
    const tenantId = readTenantFilter(scope);
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
    const rows = tenantId
      ? await ctx.db
          .query("reportExports")
          .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
          .collect()
      : await ctx.db.query("reportExports").order("desc").take(limit);
    return rows.sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
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
    await logAudit(ctx, { action: "report.create", entityTable: "scheduledReports", entityId: id, changedBy: user._id, after: args });
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
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Scheduled report not found");
    const scope = await readScopedTenant(ctx);
    const denial = decideTenantResourceWrite(scope, report.tenantId, "scheduled report");
    if (denial) throw new Error(`Unauthorized: ${denial}`);
    const patch = { name: args.name, recipients: args.recipients, frequency: args.frequency, scopeFilter: args.scopeFilter, format: args.format, enabled: args.enabled };
    const cleaned = Object.fromEntries(Object.entries(patch).filter(([, value]) => value !== undefined));
    await ctx.db.patch(args.reportId, cleaned);
    await logAudit(ctx, { action: "report.update", entityTable: "scheduledReports", entityId: args.reportId, changedBy: user._id, after: cleaned });
  },
});

export const deleteScheduledReport = mutation({
  args: { reportId: v.id("scheduledReports") },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "reports:generate");
    const report = await ctx.db.get(args.reportId);
    if (!report) throw new Error("Scheduled report not found");
    const scope = await readScopedTenant(ctx);
    const denial = decideTenantResourceWrite(scope, report.tenantId, "scheduled report");
    if (denial) throw new Error(`Unauthorized: ${denial}`);
    await ctx.db.delete(args.reportId);
    await logAudit(ctx, { action: "report.delete", entityTable: "scheduledReports", entityId: args.reportId, changedBy: user._id });
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

/**
 * Build rows for a dataset. Runs inside actions via runQuery.
 *
 * When `tenantId` is supplied the rows are restricted to that tenant; when it
 * is omitted the caller is a Platform control-plane reader and the rows are
 * unscoped. A tenant-owned scheduled report always passes its tenant id.
 */
export const collectReportRows = internalQuery({
  args: {
    dataset: v.string(),
    month: v.optional(v.string()),
    tenantId: v.optional(v.id("tenants")),
  },
  handler: async (ctx, args) => {
    const month = args.month ?? monthOf(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const tenantId = args.tenantId;
    switch (args.dataset) {
      case "revenue": {
        const snapshots = tenantId
          ? await ctx.db
              .query("dailySnapshots")
              .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
              .collect()
          : await ctx.db
              .query("dailySnapshots")
              .withIndex("by_date", (q) => q.lte("date", dayOf(Date.now())))
              .collect();
        return {
          header: ["date", "marketId", "revenueLocal", "revenueUSD", "salesCount", "newSubscribers", "netContributionLocal", "currency"],
          rows: snapshots
            .filter((s) => s.date.startsWith(month.slice(0, 7)))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => [s.date, s.marketId, s.revenueLocal, s.revenueUSD, s.salesCount, s.newSubscribers, s.netContributionLocal, s.currency]),
        };
      }
      case "subscribers": {
        const subs = tenantId
          ? await ctx.db
              .query("subscriberSnapshots")
              .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
              .collect()
          : await ctx.db.query("subscriberSnapshots").collect();
        return {
          header: ["date", "marketId", "activeCount", "newCount", "renewalCount", "renewalRate", "avgPlanPriceLocal", "currency"],
          rows: subs
            .filter((s) => s.date.startsWith(month.slice(0, 7)))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => [s.date, s.marketId, s.activeCount, s.newCount, s.renewalCount, s.renewalRate?.toFixed(3), s.avgPlanPriceLocal, s.currency]),
        };
      }
      case "financials": {
        const fin = tenantId
          ? (await ctx.db
              .query("marketFinancials")
              .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
              .collect()).filter((f) => f.month === month)
          : await ctx.db.query("marketFinancials").withIndex("by_month", (q) => q.eq("month", month)).collect();
        const exp = tenantId
          ? (await ctx.db
              .query("expenses")
              .withIndex("by_tenant", (q) => q.eq("tenantId", tenantId))
              .collect()).filter((e) => e.month === month)
          : await ctx.db.query("expenses").withIndex("by_month", (q) => q.eq("month", month)).collect();
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
 * validated by that user's active membership. Actions cannot read the database
 * directly, so `generateReport` hands the already-verified user id and the
 * organization claim from its own identity to this internal query. An unmapped
 * organization or inactive membership yields null (a Platform reader).
 */
export const resolveCallerTenant = internalQuery({
  args: { userId: v.id("users"), organizationId: v.optional(v.string()) },
  handler: async (ctx, args) => {
    if (!args.organizationId) return null;
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
    return tenant._id;
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

    const data = await ctx.runQuery(internal.scheduledReports.collectReportRows, {
      dataset: args.dataset,
      month: args.scopeFilter?.month,
      tenantId: tenantId ?? undefined,
    });

    let fileId: string | undefined;
    if (args.format === "csv") {
      const csv = toCsv(data.header, data.rows);
      const blob = new Blob([csv], { type: "text/csv" });
      fileId = (await ctx.storage.store(blob)) as string;
    } else {
      // PDF: minimal, dependency-free HTML snapshot rendered to a stored blob.
      const html = `<html><body><h1>${args.dataset} report</h1><pre>${JSON.stringify(data, null, 2)}</pre></body></html>`;
      const blob = new Blob([html], { type: "text/html" });
      fileId = (await ctx.storage.store(blob)) as string;
    }

    const exportId: string = await ctx.runMutation(internal.scheduledReports.recordExport, {
      scheduledReportId: args.scheduledReportId,
      requestedBy: reporter._id,
      format: args.format,
      scopeFilter: args.scopeFilter,
      dataset: args.dataset,
      fileId: fileId as never,
      tenantId: tenantId ?? undefined,
    });
    return { exportId };
  },
});

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
    return await ctx.db.insert("reportExports", {
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
        const data = await ctx.runQuery(internal.scheduledReports.collectReportRows, {
          dataset,
          month: now.toISOString().slice(0, 7),
          tenantId: report.tenantId,
        });
        const blob = new Blob([toCsv(data.header, data.rows)], { type: "text/csv" });
        const fileId = (await ctx.storage.store(blob)) as string;
        await ctx.runMutation(internal.scheduledReports.recordExport, {
          scheduledReportId: report._id,
          requestedBy: report.createdBy,
          format: "csv",
          scopeFilter: report.scopeFilter,
          dataset,
          fileId: fileId as never,
          tenantId: report.tenantId,
        });
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
