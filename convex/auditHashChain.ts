import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { Id } from "./_generated/dataModel";
import { requirePlatformUser } from "./lib/auth";
import { computeAuditHash, verifyAuditChain, type AuditChainRow } from "./lib/auditHashCore";

export const AUDIT_HASH_BACKFILL_RUN_ID = "audithash-backfill-001";

/**
 * One-time backfill that hashes every pre-existing auditLog row so the L2
 * tamper-evident chain covers the whole table (rows written before this
 * deploy have no `hash`). Treat like a production data migration: bounded
 * batches, resumable, and every step logged to a `migrationRuns` row.
 *
 * IMPORTANT — do not overstate what this gives you. The backfill computes a
 * hash for the historical rows, but nobody was signing them at write time, so
 * the paper trail is only tamper-evident from the backfill moment forward. A
 * historical row altered BEFORE this migration produces a hash that verifies
 * (it would be backfilled over the modified payload). Extra-tenant integrity
 * coverage is the same as always. What the backfill DOES guarantee: from the
 * backfill instant on, any modification to a row is detected by the chain
 * verification.
 *
 * Run manually (not cron-wired), one batch per invocation, until it reports
 * `done: true`:
 *   npx convex run auditHashChain:runAuditHashBackfill --args '{}'
 */
export const runAuditHashBackfill = internalMutation({
  args: {},
  handler: async (ctx) => {
    const runId = AUDIT_HASH_BACKFILL_RUN_ID;
    const now = Date.now();
    const batchSize = 200;

    const existing = await ctx.db
      .query("migrationRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", runId))
      .first();

    if (existing?.status === "completed") {
      return { done: true, runId, rowsProcessed: existing.rowsProcessed, status: existing.status };
    }

    let runDocId: Id<"migrationRuns">;
    if (existing) {
      runDocId = existing._id;
    } else {
      runDocId = await ctx.db.insert("migrationRuns", {
        runId,
        name: "audit-hash-backfill",
        tables: ["auditLog"],
        status: "running" as const,
        rowsProcessed: 0,
        manifest: {},
        requiredFlags: [],
        failedAssertions: [],
        startedAt: now,
        createdAt: now,
      });
    }

    const manifest = (existing?.manifest ?? {}) as { lastHash?: string };
    // Chain context carried across batches so an interrupted run resumes
    // cleanly instead of re-linking from a wrong head.
    let chainHead = manifest.lastHash;

    const page = await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("asc")
      .paginate({ numItems: batchSize, cursor: existing?.cursor ?? null });

    let patched = 0;
    for (const row of page.page) {
      const corrected = await computeAuditHash({
        prevHash: chainHead ?? "",
        action: row.action,
        entityTable: row.entityTable,
        entityId: row.entityId,
        changedBy: String(row.changedBy),
        timestamp: row.timestamp,
        afterJson: row.afterJson ?? "",
      });
      const needsRewrite =
        row.hash === undefined || row.hash === null || row.hash !== corrected;
      if (needsRewrite) {
        await ctx.db.patch(row._id, { prevHash: chainHead, hash: corrected });
        patched += 1;
      }
      chainHead = corrected;
    }

    const rowsProcessed = (existing?.rowsProcessed ?? 0) + patched;
    const isDone = page.isDone;

    const overrides: {
      status: "running" | "completed";
      rowsProcessed: number;
      manifest: { lastHash?: string };
      cursor?: string;
      completedAt?: number;
    } = {
      status: isDone ? "completed" : "running",
      rowsProcessed,
      manifest: { ...manifest, lastHash: chainHead },
    };
    if (!isDone) overrides.cursor = page.continueCursor;
    else overrides.completedAt = Date.now();

    await ctx.db.patch(runDocId, overrides);

    return {
      done: isDone,
      runId,
      rowsProcessed,
      patchedThisBatch: patched,
      cursor: page.isDone ? null : page.continueCursor,
      status: isDone ? "completed" : "running",
    };
  },
});

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