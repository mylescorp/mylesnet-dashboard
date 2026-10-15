import { v } from "convex/values";
import { query } from "./_generated/server";
import { requirePlatformUser } from "./lib/auth";
import { verifyAuditChain, type AuditChainRow } from "./lib/auditHashCore";

/**
 * Walk the whole auditLog chain and report whether it is internally consistent
 * (each row's hash recomputes correctly and links to its predecessor). Returns
 * the first mismatch only — verification is a paper-trail check, not a fix.
 *
 * Intentionally NOT paginated beyond a bounded walk: recomputation is CPU
 * bound, so the walk stops at the first broken or missing link, at the table
 * end, or at `limit` rows. `complete` is false when the walk stopped at the
 * limit, so the caller can extend it for a full sweep.
 */
export const verifyAuditHashChain = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requirePlatformUser(ctx);
    const limit = Math.min(20000, args.limit ?? 10000);

    const rows: AuditChainRow[] = (
      await ctx.db
        .query("auditLog")
        .withIndex("by_timestamp")
        .order("asc")
        .take(limit)
    ).map((row) => ({
      id: row._id,
      action: row.action,
      entityTable: row.entityTable,
      entityId: row.entityId,
      changedBy: String(row.changedBy),
      timestamp: row.timestamp,
      beforeJson: row.beforeJson,
      afterJson: row.afterJson,
      prevHash: row.prevHash,
      hash: row.hash,
    }));

    const result = await verifyAuditChain(rows);
    return { ...result, complete: rows.length < limit };
  },
});
