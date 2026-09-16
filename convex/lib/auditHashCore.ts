/**
 * L2 tamper-evident audit chain core. Pure, dependency-free helpers so they
 * can be unit-tested with node:test. No Convex
 * imports.
 *
 * Chain contract (approved L2 Option A):
 *   hash = SHA-256(canonicalString(prevHash, action, entityTable, entityId,
 *                                   changedBy, timestamp, afterJson))
 * where `prevHash` is the hash of the immediately preceding audit row. Rows
 * written BEFORE the one-time backfill carry no hash/prevHash and are only
 * tamper-evident from the backfill date forward — never overstated as
 * "tamper-evident since inception".
 */

export interface AuditChainFields {
  prevHash: string;
  action: string;
  entityTable: string;
  entityId: string;
  changedBy: string;
  timestamp: number;
  afterJson: string;
}

/** A flat row as read from the auditLog table (or a test fixture). */
export interface AuditChainRow {
  id: string;
  action: string;
  entityTable: string;
  entityId: string;
  changedBy: string;
  timestamp: number;
  beforeJson?: string | null;
  afterJson?: string | null;
  prevHash?: string | null;
  hash?: string | null;
}

export type ChainMismatchKind =
  | "missing_prev"
  | "missing_hash"
  | "bad_hash"
  | "broken_link";

export interface ChainMismatch {
  index: number;
  id: string;
  kind: ChainMismatchKind;
  detail: string;
}

export interface ChainVerification {
  valid: boolean;
  total: number;
  linked: number;
  mismatches: ChainMismatch[];
}

/**
 * Deterministic canonical serialization of the hashed payload. Uses
 * JSON.stringify of a fixed-order array so the digest is identical across
 * runtimes regardless of object key ordering. Null/undefined `afterJson`
 * normalizes to "" (the helper stores undefined when no snapshot is passed).
 */
export function canonicalAuditString(input: AuditChainFields): string {
  return JSON.stringify([
    input.prevHash,
    input.action,
    input.entityTable,
    input.entityId,
    input.changedBy,
    input.timestamp,
    input.afterJson,
  ]);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** SHA-256 digest of a string, hex-encoded. WebCrypto is available in both
 * the Convex runtime and Node 18+. */
export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return toHex(new Uint8Array(digest));
}

/** Compute the chainable hash for a row given its canonical fields. */
export async function computeAuditHash(fields: AuditChainFields): Promise<string> {
  return sha256Hex(canonicalAuditString(fields));
}

/**
 * Verify a chain over rows in insertion (timestamp) order. Checks two things
 * per row: (1) the stored `hash` equals a recomputation from its own fields
 * ("bad_hash" / "missing_hash"), and (2) the row's `prevHash` equals the
 * previous row's hash ("broken_link" / "missing_prev"). The first row legitimately
 * has no `prevHash`. Rows written before the backfill have neither field and
 * therefore always fail the checks — that is the intended, honest behaviour.
 */
export async function verifyAuditChain(rows: readonly AuditChainRow[]): Promise<ChainVerification> {
  const mismatches: ChainMismatch[] = [];
  let linked = 0;

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    if (!row) continue;

    if (index === 0) {
      // Genesis row: no predecessor to link to. A stored prevHash here is
      // suspicious — record it as a broken link only if present.
      if (row.prevHash !== undefined && row.prevHash !== null) {
        mismatches.push({
          index,
          id: row.id,
          kind: "broken_link",
          detail: "genesis row unexpectedly declares a prevHash",
        });
      }
    } else {
      const previous = rows[index - 1];
      if (row.prevHash === undefined || row.prevHash === null) {
        mismatches.push({
          index,
          id: row.id,
          kind: "missing_prev",
          detail: "row is not linked to its predecessor",
        });
      } else if (previous?.hash && row.prevHash !== previous.hash) {
        mismatches.push({
          index,
          id: row.id,
          kind: "broken_link",
          detail: `prevHash does not match prior row hash`,
        });
      } else {
        linked += 1;
      }
    }

    if (row.hash === undefined || row.hash === null) {
      mismatches.push({
        index,
        id: row.id,
        kind: "missing_hash",
        detail: "row has no computed hash",
      });
      continue;
    }

    const expected = await computeAuditHash({
      prevHash: row.prevHash ?? "",
      action: row.action,
      entityTable: row.entityTable,
      entityId: row.entityId,
      changedBy: row.changedBy,
      timestamp: row.timestamp,
      afterJson: row.afterJson ?? "",
    });
    if (expected !== row.hash) {
      mismatches.push({
        index,
        id: row.id,
        kind: "bad_hash",
        detail: "recomputed hash does not match stored hash",
      });
    }
  }

  return {
    valid: mismatches.length === 0,
    total: rows.length,
    linked,
    mismatches,
  };
}
