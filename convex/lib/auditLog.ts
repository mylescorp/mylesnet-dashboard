import { MutationCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";

/**
 * Unified audit log writer. Call this from every mutation that changes
 * state — not just deletions (soft-delete fields cover that separately).
 * Covers commission edits, market status changes, device swaps, assignment
 * changes, approval actions, everything.
 */
export async function logAudit(
  ctx: MutationCtx,
  params: {
    action: string; // e.g. "commission.approve", "market.statusChange"
    entityTable: string;
    entityId: string;
    changedBy: Id<"users">;
    before?: unknown;
    after?: unknown;
    ip?: string;
  }
) {
  await ctx.db.insert("auditLog", {
    action: params.action,
    entityTable: params.entityTable,
    entityId: params.entityId,
    changedBy: params.changedBy,
    beforeJson: params.before !== undefined ? JSON.stringify(params.before) : undefined,
    afterJson: params.after !== undefined ? JSON.stringify(params.after) : undefined,
    timestamp: Date.now(),
    ip: params.ip,
  });
}

/** Read-only helper for the /platform/audit-log screen. */
export async function listAuditLog(
  ctx: { db: MutationCtx["db"] },
  opts: {
    entityTable?: string;
    limit?: number;
    cursor?: string | null;
  }
) {
  const limit = Math.min(100, opts.limit ?? 50);
  if (opts.entityTable) {
    const items = await ctx.db
      .query("auditLog")
      .withIndex("by_entity", (q) => q.eq("entityTable", opts.entityTable!))
      .order("desc")
      .take(limit + 1);
    return {
      items: items.slice(0, limit),
      nextCursor: items.length > limit ? (items[limit - 1]._id as string) : null,
    };
  }
  const items = await ctx.db.query("auditLog").order("desc").take(limit + 1);
  return {
    items: items.slice(0, limit),
    nextCursor: items.length > limit ? (items[limit - 1]._id as string) : null,
  };
}
