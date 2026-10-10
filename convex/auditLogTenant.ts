import { v } from "convex/values";
import { query } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { requireTenantPermission } from "./lib/auth";

const ENTITY_LABELS: Record<string, string> = {
  subscribers: "Subscriber",
  markets: "Market",
  agents: "Agent",
  vouchers: "Voucher",
  commissions: "Commission",
  invoices: "Invoice",
  payments: "Payment",
  plans: "Plan",
  expenses: "Expense",
  teams: "Team",
};

const ACTION_LABELS: Record<string, string> = {
  create: "created",
  created: "created",
  update: "updated",
  updated: "updated",
  delete: "archived",
  archive: "archived",
  softDelete: "archived",
  archived: "archived",
  restore: "restored",
  restored: "restored",
  suspend: "suspended",
  reactivate: "reactivated",
  approve: "approved",
  reject: "declined",
  record: "recorded",
  assignToMarket: "assignment changed",
  statusChange: "status changed",
  offboard: "offboarding updated",
  finalize: "offboarding completed",
  redeem: "redeemed",
  allocate: "allocated",
  generate: "created",
  refund: "refunded",
};

function presentTenantAuditEntry(entry: Doc<"auditLog">) {
  const entityType = ENTITY_LABELS[entry.entityTable] ?? "Workspace activity";
  const actionSuffix = entry.action.split(".").at(-1) ?? "update";
  const action = ACTION_LABELS[actionSuffix]
    ? `${entityType} ${ACTION_LABELS[actionSuffix]}`
    : `${entityType} activity recorded`;
  const labelFields = ["name", "title", "subject", "planName", "marketName", "tenantName", "deviceName", "serverName"];
  const labelFrom = (json: string | undefined): string | null => {
    if (!json) return null;
    try {
      const values = JSON.parse(json) as Record<string, unknown>;
      for (const field of labelFields) {
        const value = values[field];
        if (typeof value === "string" && value.trim()) return value.trim().slice(0, 120);
      }
    } catch { /* Older malformed audit data has no display label. */ }
    return null;
  };
  return {
    _id: entry._id,
    action,
    entityType,
    entityLabel: labelFrom(entry.afterJson) ?? labelFrom(entry.beforeJson) ?? entityType,
    changedBy: entry.changedBy,
    timestamp: entry.timestamp,
  };
}

/**
 * Tenant-scoped audit trail. The platform audit log (`platform.listAuditLog`)
 * remains platform-only; this query exposes only the caller's own tenant's
 * rows and only when the active tenant membership holds `audit_log:read`.
 * Rows are newest-first and cursor-paginated.
 */
export const listForTenant = query({
  args: {
    entityTable: v.optional(v.string()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.nullable(v.string())),
  },
  handler: async (ctx, args) => {
    const { user, tenantId } = await requireTenantPermission(ctx, "audit_log:read");
    const limit = Math.min(100, args.limit ?? 50);
    const base = args.entityTable
      ? ctx.db
          .query("auditLog")
          .withIndex("by_entity", (q) => q.eq("entityTable", args.entityTable!))
          .filter((q) => q.eq(q.field("tenantId"), tenantId))
          .order("desc")
      : ctx.db
          .query("auditLog")
          .withIndex("by_tenant_timestamp", (q) => q.eq("tenantId", tenantId))
          .order("desc");
    const { page, isDone, continueCursor } = await base.paginate({
      numItems: limit,
      cursor: args.cursor ?? null,
    });
    const actors = await Promise.all(page.map((entry) => ctx.db.get(entry.changedBy)));
    return {
      entries: page.map((entry, index) => ({
        ...presentTenantAuditEntry(entry),
        changedByName: actors[index]?.name ?? "Workspace member",
        isCurrentUser: entry.changedBy === user._id,
      })),
      isDone,
      continueCursor,
    };
  },
});
