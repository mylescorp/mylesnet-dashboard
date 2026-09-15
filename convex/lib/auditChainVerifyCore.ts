/**
 * Pure, stateful verification of the entire SEALED audit chain.
 *
 * The other agent's `auditChainCore.ts` verifies a contiguous in-memory run;
 * that cannot cover a table that grows over time from a synchronous query.
 * This module drives the same primitives (canonical payload, SHA-256,
 * genesis sentinel) across an unbounded walk, accumulating state between
 * batches so a background sweep can cover every sealed row from genesis
 * forward without re-scanning on every tick.
 *
 * Sealed rows are the post-deployment suffix of `auditLog`: rows recorded by
 * the central `logAudit` writer carry `hash`/`prevHash`/`chainSequence`.
 * Legacy rows (pre-deployment, unsealed) are skipped and counted, never
 * treated as part of the chain.
 */
import { AUDIT_CHAIN_GENESIS, hashAuditChainPayload } from "./auditChainCore.ts";

export type AuditChainIssue =
  | "invalid_genesis"
  | "invalid_sequence"
  | "missing_link"
  | "invalid_hash";

/** A single auditLog row projected onto the fields verification needs. */
export interface AuditChainVerifyRow {
  hash?: string | null;
  prevHash?: string | null;
  chainSequence?: number | null;
  action: string;
  entityTable: string;
  entityId: string;
  changedBy: string;
  beforeJson?: string | null;
  afterJson?: string | null;
  timestamp: number;
  ip?: string | null;
}

/**
 * Accumulated verification state. `lastChainSequence`/`lastHash` reseed the
 * next batch so a sweep interrupted mid-table resumes with a correct link;
 * the remaining fields are the running sweep's progress report.
 */
export interface AuditChainVerifyState {
  lastChainSequence: number;
  lastHash: string;
  checkedEntries: number;
  firstSequence: number | null;
  lastSequence: number | null;
  startsAt: number | null;
  endsAt: number | null;
  legacySkipped: number;
  issue: AuditChainIssue | null;
}

export function newVerifyState(): AuditChainVerifyState {
  return {
    lastChainSequence: 0,
    lastHash: "",
    checkedEntries: 0,
    firstSequence: null,
    lastSequence: null,
    startsAt: null,
    endsAt: null,
    legacySkipped: 0,
    issue: null,
  };
}

/**
 * Rebuild in-memory state from a persisted `migrationRuns.manifest` so a
 * sweep can resume after an interrupted run. Unknown/missing keys fall back
 * to a fresh state.
 */
export function verifyStateFromManifest(manifest: Record<string, unknown>): AuditChainVerifyState {
  return {
    lastChainSequence: typeof manifest.lastChainSequence === "number" ? manifest.lastChainSequence : 0,
    lastHash: typeof manifest.lastHash === "string" ? manifest.lastHash : "",
    checkedEntries: typeof manifest.checkedEntries === "number" ? manifest.checkedEntries : 0,
    firstSequence: typeof manifest.firstSequence === "number" ? manifest.firstSequence : null,
    lastSequence: typeof manifest.lastSequence === "number" ? manifest.lastSequence : null,
    startsAt: typeof manifest.startsAt === "number" ? manifest.startsAt : null,
    endsAt: typeof manifest.endsAt === "number" ? manifest.endsAt : null,
    legacySkipped: typeof manifest.legacySkipped === "number" ? manifest.legacySkipped : 0,
    issue: typeof manifest.issue === "string" ? (manifest.issue as AuditChainIssue) : null,
  };
}

/** Select the fields of a state that must be persisted for a live resume. */
export function verifyStateToManifest(state: AuditChainVerifyState): Record<string, unknown> {
  return {
    lastChainSequence: state.lastChainSequence,
    lastHash: state.lastHash,
    checkedEntries: state.checkedEntries,
    firstSequence: state.firstSequence,
    lastSequence: state.lastSequence,
    startsAt: state.startsAt,
    endsAt: state.endsAt,
    legacySkipped: state.legacySkipped,
    issue: state.issue,
  };
}

/**
 * Structural classification of a sealed entry against the running state —
 * independent of the hash recomputation so tests can target linkage rules.
 * The genesis sentinel bounds the chain start: the first sealed row MUST have
 * chainSequence 1 with prevHash == AUDIT_CHAIN_GENESIS.
 */
export function verifyIssueFor(entry: AuditChainVerifyRow, state: AuditChainVerifyState): AuditChainIssue | null {
  if (state.lastChainSequence === 0) {
    if (entry.chainSequence !== 1) return "invalid_genesis";
    if (entry.prevHash !== AUDIT_CHAIN_GENESIS) return "invalid_genesis";
  } else {
    if (entry.chainSequence !== state.lastChainSequence + 1) return "invalid_sequence";
    if (entry.prevHash !== state.lastHash) return "missing_link";
  }
  return null;
}

/**
 * Fold one projected row into the sweep state. Unsealed (legacy) rows are
 * skipped and counted. The first structural issue is kept (subsequent rows
 * are still walked so coverage is complete); payload integrity is asserted by
 * recomputing SHA-256 over the stored canonical fields.
 */
export async function nextVerifyState(
  state: AuditChainVerifyState,
  entry: AuditChainVerifyRow,
): Promise<AuditChainVerifyState> {
  if (entry.hash == null || entry.prevHash == null || entry.chainSequence == null) {
    return { ...state, legacySkipped: state.legacySkipped + 1 };
  }

  const issue = state.issue ?? verifyIssueFor(entry, state);
  let finalIssue = issue;
  if (issue === null) {
    const recomputed = await hashAuditChainPayload({
      chainSequence: entry.chainSequence,
      prevHash: entry.prevHash,
      action: entry.action,
      entityTable: entry.entityTable,
      entityId: entry.entityId,
      changedBy: entry.changedBy,
      beforeJson: entry.beforeJson ?? undefined,
      afterJson: entry.afterJson ?? undefined,
      timestamp: entry.timestamp,
      ip: entry.ip ?? undefined,
    });
    if (recomputed !== entry.hash) finalIssue = "invalid_hash";
  }

  return {
    lastChainSequence: entry.chainSequence,
    lastHash: entry.hash,
    checkedEntries: state.checkedEntries + 1,
    firstSequence: state.firstSequence ?? entry.chainSequence,
    lastSequence: entry.chainSequence,
    startsAt: state.startsAt ?? entry.timestamp,
    endsAt: entry.timestamp,
    legacySkipped: state.legacySkipped,
    issue: finalIssue,
  };
}