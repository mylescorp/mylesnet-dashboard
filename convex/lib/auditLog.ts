import { MutationCtx, QueryCtx } from "../_generated/server";
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

/** Read-only cursor helper for the audit screens. Honors `cursor` via Convex pagination. */
export async function listAuditLog(
  ctx: { db: QueryCtx["db"] },
  opts: {
    entityTable?: string;
    limit?: number;
    cursor?: string | null;
  }
) {
  const numItems = Math.min(100, opts.limit ?? 50);
  const base = opts.entityTable
    ? ctx.db.query("auditLog").withIndex("by_entity", (q) => q.eq("entityTable", opts.entityTable!))
    : ctx.db.query("auditLog");
  const page = await base.order("desc").paginate({ numItems, cursor: opts.cursor ?? null });
  return {
    items: page.page,
    nextCursor: page.isDone ? null : page.continueCursor,
  };
}
