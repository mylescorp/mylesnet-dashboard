import { MutationCtx, QueryCtx } from "../_generated/server";
import { Id } from "../_generated/dataModel";
import { AUDIT_CHAIN_GENESIS, hashAuditChainPayload } from "./auditChainCore";

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
  const beforeJson = params.before !== undefined ? JSON.stringify(params.before) : undefined;
  const afterJson = params.after !== undefined ? JSON.stringify(params.after) : undefined;
  // Convex mutations are serializable. Reading the current tail means a
  // concurrent writer is retried before it can append a competing chain link.
  const previous = await ctx.db.query("auditLog").withIndex("by_timestamp").order("desc").first();
  const chainSequence = (previous?.chainSequence ?? 0) + 1;
  // Preserve a total, deterministic order even when several mutations share a
  // millisecond, and never place an append before an imported legacy record.
  const timestamp = Math.max(Date.now(), (previous?.timestamp ?? 0) + 1);
  const prevHash = previous?.hash ?? AUDIT_CHAIN_GENESIS;
  const hash = await hashAuditChainPayload({
    chainSequence,
    prevHash,
    action: params.action,
    entityTable: params.entityTable,
    entityId: params.entityId,
    changedBy: params.changedBy,
    beforeJson,
    afterJson,
    timestamp,
    ip: params.ip,
  });

  await ctx.db.insert("auditLog", {
    action: params.action,
    entityTable: params.entityTable,
    entityId: params.entityId,
    changedBy: params.changedBy,
    beforeJson,
    afterJson,
    timestamp,
    ip: params.ip,
    chainSequence,
    prevHash,
    hash,
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
