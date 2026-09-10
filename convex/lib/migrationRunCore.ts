/**
 * Pure migration-run domain logic for the Phase 0 "migration run infrastructure"
 * gate (§B2). Kept free of Convex imports so `npm test` can exercise it with
 * plain node:test (mirrors deviceCommandCore.ts / centipidVerify.ts).
 *
 * The Phase 1 `tenantId` backfill uses these invariants:
 *  - every run is idempotent and tracked by an immutable run id,
 *  - backfills run in bounded batches (no unbounded single scan),
 *  - assertions gate enforcement checkpoints,
 *  - feature flags make each checkpoint reversible / gated,
 *  - export manifests and rollback checkpoints make a run recoverable or
 *    revertible as one tracked operation.
 */

/** Lifecycle of a migration run. */
export type MigrationRunStatus =
  | "planned"
  | "running"
  | "completed"
  | "rolled_back"
  | "failed"
  | "cancelled";

/** Direction a run moves towards accessory that is currently only forward. */
export type MigrationRunTransition = "start" | "complete" | "rollback" | "fail" | "cancel";

/** A single bounded batch within a run (cursor + ids to process). */
export interface BoundedBatch<T> {
  /** Opaque cursor: the last processed key so the next batch resumes after it. */
  cursor: string | null;
  /** The bounded slice of keys/ids for this batch (length <= batchSize). */
  batch: T[];
  /** True when there is at least one more batch after this one. */
  hasMore: boolean;
}

/** Row/reference count assertion for gating a checkpoint. */
export interface RowCountAssertion {
  name: string;
  expected: number;
  actual: number;
}

/** Invariant assertion (arbitrary predicate over a scalar). */
export interface InvariantAssertion {
  name: string;
  ok: boolean;
  detail?: string;
}

/** A declared rollback checkpoint: where to return to if this run is reverted. */
export interface RollbackCheckpoint {
  phase: string;
  cursor: string | null;
  rowsProcessed: number;
  recordedAt: number;
}

/** Aggregated manifest of what the run moved or wrote. */
export interface MigrationManifest {
  [table: string]: number;
}

/**
 * Model a run's success/error handling: collect per-batch counts and fail the
 * run (transition to `failed`) if any step throws. Idempotent — a completed or
 * rolled_back run never re-runs.
 */
export function nextRunStatus(
  status: MigrationRunStatus,
  transition: MigrationRunTransition,
): MigrationRunStatus {
  if (status === "planned" && transition === "start") return "running";
  if (status === "running" && transition === "complete") return "completed";
  if (status === "running" && transition === "rollback") return "rolled_back";
  if (status === "running" && transition === "fail") return "failed";
  if (status === "planned" && transition === "cancel") return "cancelled";
  if (status === "running" && transition === "cancel") return "cancelled";
  return status;
}

/** True when a run may be started / advanced (not yet terminal). */
export function isActiveRun(status: MigrationRunStatus): boolean {
  return status === "planned" || status === "running";
}

/**
 * Chunk a full ordered key list into a bounded batch, advancing a cursor so the
 * consumer never scans the whole table in one call (§B2 "bounded backfills").
 */
export function takeBoundedBatch<T>(
  orderedKeys: T[],
  cursorIndex: number,
  batchSize: number,
): BoundedBatch<T> {
  const safeSize = Number.isFinite(batchSize) && batchSize > 0 ? Math.floor(batchSize) : 0;
  if (safeSize <= 0) return { cursor: null, batch: [], hasMore: false };
  const start = Math.max(0, cursorIndex);
  const slice = orderedKeys.slice(start, start + safeSize);
  const nextIndex = start + slice.length;
  return {
    cursor: nextIndex < orderedKeys.length ? String(nextIndex) : null,
    batch: slice,
    hasMore: nextIndex < orderedKeys.length,
  };
}

/** Parse a run cursor (index) back to a number, defaulting to 0. */
export function cursorToIndex(cursor: string | null | undefined): number {
  if (!cursor) return 0;
  const parsed = Number.parseInt(cursor, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

/**
 * Merge a batch's per-table counts into the run manifest (idempotent add).
 */
export function mergeBatchIntoManifest(
  manifest: MigrationManifest,
  batchCounts: MigrationManifest,
): MigrationManifest {
  const next = { ...manifest };
  for (const [table, count] of Object.entries(batchCounts)) {
    next[table] = (next[table] ?? 0) + count;
  }
  return next;
}

/**
 * Assertion gate: every required row-count assertion must pass before a
 * checkpoint may proceed. Returns the list of names that failed.
 */
export function failingCountAssertions(assertions: RowCountAssertion[]): string[] {
  return assertions.filter((assertion) => assertion.actual !== assertion.expected).map((a) => a.name);
}

/**
 * Invariant gate: every invariant must be `ok` before a checkpoint may proceed.
 * Returns the list of failed invariant names (with detail).
 */
export function failingInvariants(invariants: InvariantAssertion[]): InvariantAssertion[] {
  return invariants.filter((invariant) => !invariant.ok);
}

/**
 * Declare a rollback checkpoint for the current phase. Returns the checkpoint
 * to persist so a rollback can restore to this point (cursor + rows processed).
 */
export function recordCheckpoint(
  phase: string,
  cursor: string | null,
  rowsProcessed: number,
  now: number,
): RollbackCheckpoint {
  return { phase, cursor, rowsProcessed, recordedAt: now };
}

/**
 * Feature-flag enforcement decision for a reversible checkpoint. A checkpoint
 * is only permitted to take effect when the flag is `on`; otherwise it is
 * deferred (no-op) so the run can be halted/reverted before enforcement.
 */
export function shouldProceed(flagEnabled: boolean, required: boolean): boolean {
  if (!required) return true;
  return flagEnabled === true;
}
