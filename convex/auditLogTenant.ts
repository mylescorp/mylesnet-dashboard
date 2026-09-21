import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePermission } from "./lib/auth";
import { resolveTenantFromAuth } from "./lib/tenant";

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
    await requirePermission(ctx, "audit_log:read");
    const tenantId = await resolveTenantFromAuth(ctx);
    if (!tenantId) return { entries: [], isDone: true, continueCursor: null };
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
    return { entries: page, isDone, continueCursor };
  },
});