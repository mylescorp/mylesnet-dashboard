import { v } from "convex/values";
import { action, internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { requirePermission } from "./lib/auth";
import { enforceTenantOnResource, readScopedTenant, readTenantList } from "./lib/tenant";
import { logAudit } from "./lib/auditLog";
import { dayOf, monthOf } from "./lib/finance";
import type { Id } from "./_generated/dataModel";

/**
 * Scheduled reports (spec §29). Definitions are user-managed; the crons job
 * calls `triggerDueReports` which generates the artifact (CSV/PDF bytes via
 * _storage) and logs a `reportExports` row. Manual "generate now" runs the
 * same action.
 */

export type ReportDataset = "revenue" | "subscribers" | "financials";

export const listScheduledReports = query({
  args: {},
  handler: async (ctx) => {
    await requirePermission(ctx, "reports:read");
    const rows = await readTenantList(ctx, {
      all: () => ctx.db.query("scheduledReports").collect(),
      tenant: (tenantId) => ctx.db.query("scheduledReports").withIndex("by_tenant", (q) => q.eq("tenantId", tenantId)).collect(),
      legacy: () => ctx.db.query("scheduledReports").withIndex("by_tenant", (q) => q.eq("tenantId", undefined)).collect(),
    });
    return rows.sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const listReportExports = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "reports:read");
    const limit = Math.max(1, Math.min(100, Math.floor(args.limit ?? 50)));
    const rows = await readTenantList(ctx, {
      all: () => ctx.db.query("reportExports").order("desc").take(limit),
      tenant: (tenantId) => ctx.db.query("reportExports").withIndex("by_tenant_created", (q) => q.eq("tenantId", tenantId)).order("desc").take(limit),
      legacy: () => ctx.db.query("reportExports").withIndex("by_tenant_created", (q) => q.eq("tenantId", undefined)).order("desc").take(limit),
    });
    return rows;
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
      tenantId: scope.enforced ? scope.tenantId ?? undefined : undefined,
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
    const report = await enforceTenantOnResource(ctx, await ctx.db.get(args.reportId), "scheduled report");
    if (!report) throw new Error("Scheduled report not found");
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
    const report = await enforceTenantOnResource(ctx, await ctx.db.get(args.reportId), "scheduled report");
    if (!report) throw new Error("Scheduled report not found");
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

/** Build rows for a dataset. Runs inside actions via runQuery. */
export const collectReportRows = internalQuery({
  args: { dataset: v.string(), month: v.optional(v.string()), tenantId: v.optional(v.id("tenants")) },
  handler: async (ctx, args) => {
    const month = args.month ?? monthOf(Date.now() - 30 * 24 * 60 * 60 * 1000);
    switch (args.dataset) {
      case "revenue": {
        const snapshots = args.tenantId
          ? await ctx.db.query("dailySnapshots").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId!)).collect()
          : await ctx.db.query("dailySnapshots").withIndex("by_date", (q) => q.lte("date", dayOf(Date.now()))).collect();
        return {
          header: ["date", "marketId", "revenueLocal", "revenueUSD", "salesCount", "newSubscribers", "netContributionLocal", "currency"],
          rows: snapshots
            .filter((s) => s.date.startsWith(month.slice(0, 7)))
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => [s.date, s.marketId, s.revenueLocal, s.revenueUSD, s.salesCount, s.newSubscribers, s.netContributionLocal, s.currency]),
        };
      }
      case "subscribers": {
        const subs = args.tenantId
          ? await ctx.db.query("subscriberSnapshots").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId!)).collect()
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
        const [financialRows, expenseRows] = await Promise.all([
          args.tenantId
            ? ctx.db.query("marketFinancials").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId!)).collect()
            : ctx.db.query("marketFinancials").withIndex("by_month", (q) => q.eq("month", month)).collect(),
          args.tenantId
            ? ctx.db.query("expenses").withIndex("by_tenant", (q) => q.eq("tenantId", args.tenantId!)).collect()
            : ctx.db.query("expenses").withIndex("by_month", (q) => q.eq("month", month)).collect(),
        ]);
        const fin = financialRows.filter((row) => row.month === month);
        const exp = expenseRows.filter((row) => row.month === month);
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

/** Authenticate manual report generation before the public action reads data. */
export const authorizeReportGeneration = internalQuery({
  args: { scheduledReportId: v.optional(v.id("scheduledReports")) },
  handler: async (ctx, args) => {
    const user = await requirePermission(ctx, "reports:generate");
    const scope = await readScopedTenant(ctx);
    if (args.scheduledReportId) {
      const report = await ctx.db.get(args.scheduledReportId);
      const ownedReport = await enforceTenantOnResource(ctx, report, "scheduled report");
      if (!ownedReport) throw new Error("Scheduled report not found");
    }
    return { userId: user._id, tenantId: scope.enforced ? scope.tenantId : null };
  },
});

/** Generate one report artifact now (manual or scheduled). */
export const generateReport = action({
  args: {
    scheduledReportId: v.optional(v.id("scheduledReports")),
    dataset: v.union(v.literal("revenue"), v.literal("subscribers"), v.literal("financials")),
    format: v.union(v.literal("pdf"), v.literal("csv")),
    scopeFilter: v.optional(v.any()),
  },
  handler: async (ctx, args): Promise<{ exportId: string }> => {
    const actor = await ctx.runQuery(internal.scheduledReports.authorizeReportGeneration, { scheduledReportId: args.scheduledReportId });

    const data = await ctx.runQuery(internal.scheduledReports.collectReportRows, {
      dataset: args.dataset,
      month: args.scopeFilter?.month,
      tenantId: actor.tenantId ?? undefined,
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
      requestedBy: actor.userId,
      tenantId: actor.tenantId ?? undefined,
      format: args.format,
      scopeFilter: args.scopeFilter,
      dataset: args.dataset,
      fileId: fileId as never,
    });
    return { exportId };
  },
});

export const recordExport = internalMutation({
  args: {
    scheduledReportId: v.optional(v.id("scheduledReports")),
    requestedBy: v.id("users"),
    tenantId: v.optional(v.id("tenants")),
    format: v.union(v.literal("pdf"), v.literal("csv")),
    scopeFilter: v.optional(v.any()),
    dataset: v.optional(v.string()),
    fileId: v.optional(v.id("_storage")),
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
    await requirePermission(ctx, "reports:read");
    const report = await enforceTenantOnResource(ctx, await ctx.db.get(args.exportId), "report export");
    if (!report) throw new Error("Report export not found");
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
          tenantId: report.tenantId,
          format: "csv",
          scopeFilter: report.scopeFilter,
          dataset,
          fileId: fileId as never,
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
