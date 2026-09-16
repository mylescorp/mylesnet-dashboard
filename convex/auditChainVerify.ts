/**
 * Background, resumable sweep that verifies the ENTIRE post-deployment sealed
 * audit chain — every auditLog row carrying hash/prevHash/chainSequence, from
 * the genesis sentinel forward — not a bounded window.
 *
 * Why a sweep and not a query: auditLog grows forever, so a synchronous full
 * chain walk re-runs on every subscriber and / or exceeds query limits. Instead
 * one canonical `migrationRuns` row (`audit-chain-verify-001`) tracks progress
 * (opaque paginate cursor + accumulated verification state in the manifest).
 * A cron tick advances a running sweep or starts a fresh full sweep once the
 * previous one has finished, so coverage re-verifies the whole sealed chain on
 * a rolling basis. Each bounded batch is one internalMutation; long chains
 * chain further batches via `ctx.scheduler.runAfter(0, ...)` (same pattern as
 * scheduled audit maintenance).
 *
 * Legacy rows (pre-deployment, no integrity hash) are walked over but never
 * treated as part of the chain — they are counted as `legacySkipped` so the
 * UI can keep explaining them honestly.
 */
import { internalMutation } from "./_generated/server";
import { internal } from "./_generated/api";
import {
  newVerifyState,
  nextVerifyState,
  verifyStateFromManifest,
  verifyStateToManifest,
  type AuditChainIssue,
  type AuditChainVerifyRow,
  type AuditChainVerifyState,
} from "./lib/auditChainVerifyCore";

export const AUDIT_CHAIN_VERIFY_RUN_ID = "audit-chain-verify-001";
const SWEEP_BATCH = 500;

/** Project an auditLog row onto the fields the pure verifier needs. */
function toVerifyRow(entry: {
  hash?: string;
  prevHash?: string;
  chainSequence?: number;
  action: string;
  entityTable: string;
  entityId: string;
  changedBy: string;
  beforeJson?: string;
  afterJson?: string;
  timestamp: number;
  ip?: string;
}): AuditChainVerifyRow {
  return {
    hash: entry.hash,
    prevHash: entry.prevHash,
    chainSequence: entry.chainSequence,
    action: entry.action,
    entityTable: entry.entityTable,
    entityId: entry.entityId,
    changedBy: entry.changedBy,
    beforeJson: entry.beforeJson,
    afterJson: entry.afterJson,
    timestamp: entry.timestamp,
    ip: entry.ip,
  };
}

/** Compact "what did the last clean sweep cover" record kept across failures. */
function summaryOf(state: AuditChainVerifyState) {
  return {
    checkedEntries: state.checkedEntries,
    firstSequence: state.firstSequence,
    lastSequence: state.lastSequence,
    startsAt: state.startsAt,
    endsAt: state.endsAt,
    legacySkipped: state.legacySkipped,
  };
}

/**
 * Advance the verification sweep by one bounded batch of auditLog rows
 * (ascending timestamp == chain order for sealed rows). Runs to completion via
 * scheduler chaining; `getAuditChainHealth` reads the canonical run row.
 */
export const runAuditChainVerifyBatch = internalMutation({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const run = await ctx.db
      .query("migrationRuns")
      .withIndex("by_run_id", (q) => q.eq("runId", AUDIT_CHAIN_VERIFY_RUN_ID))
      .first();

    // A completed/failed (or missing) run restarts a fresh full sweep; a
    // `running` run continues where its cursor left off.
    const restarting = run === null || run.status !== "running";
    const state = restarting ? newVerifyState() : verifyStateFromManifest((run.manifest ?? {}) as Record<string, unknown>);
    const savedManifest = (run?.manifest ?? {}) as Record<string, unknown>;
    const lastCompletedAt = typeof savedManifest.lastCompletedAt === "number" ? savedManifest.lastCompletedAt : null;
    const lastSummary = savedManifest.lastSummary ?? null;

    const page = await ctx.db
      .query("auditLog")
      .withIndex("by_timestamp")
      .order("asc")
      .paginate({ numItems: SWEEP_BATCH, cursor: restarting ? null : (run?.cursor ?? null) });

    let next = state;
    for (const row of page.page) next = await nextVerifyState(next, toVerifyRow(row));

    let runId = run?._id ?? null;
    if (restarting && runId === null) {
      runId = await ctx.db.insert("migrationRuns", {
        runId: AUDIT_CHAIN_VERIFY_RUN_ID,
        name: "audit-chain-verify",
        tables: ["auditLog"],
        status: "running",
        rowsProcessed: 0,
        manifest: {},
        requiredFlags: [],
        failedAssertions: [],
        startedAt: now,
        createdAt: now,
      });
    } else if (restarting && runId !== null) {
      await ctx.db.patch(runId, { status: "running", startedAt: now });
    }

    const progress = verifyStateToManifest(next);
    const manifest = { ...progress, lastCompletedAt, lastSummary };

    if (!page.isDone) {
      await ctx.db.patch(runId!, {
        cursor: page.continueCursor,
        rowsProcessed: next.checkedEntries,
        manifest,
      });
      await ctx.scheduler.runAfter(0, internal.auditChainVerify.runAuditChainVerifyBatch, {});
      return { checkedEntries: next.checkedEntries, more: true };
    }

    const issue: AuditChainIssue | null = next.issue;
    if (issue === null) {
      await ctx.db.patch(runId!, {
        status: "completed",
        cursor: undefined,
        rowsProcessed: next.checkedEntries,
        manifest: { ...manifest, lastCompletedAt: now, lastSummary: summaryOf(next) },
        failedAssertions: [],
        completedAt: now,
      });
    } else {
      await ctx.db.patch(runId!, {
        status: "failed",
        cursor: undefined,
        rowsProcessed: next.checkedEntries,
        manifest,
        failedAssertions: [issue],
        completedAt: now,
      });
    }
    return { checkedEntries: next.checkedEntries, valid: issue === null, issue, more: false };
  },
});
