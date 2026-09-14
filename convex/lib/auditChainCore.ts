/**
 * Pure primitives for the audit-log integrity chain. Keeping the canonical
 * representation independent of Convex makes it possible to test exactly the
 * bytes that are signed for every audit entry.
 */
export const AUDIT_CHAIN_VERSION = 1;
export const AUDIT_CHAIN_GENESIS = "mylesnet:audit-chain:v1:genesis";

export type AuditChainPayload = {
  chainSequence: number;
  prevHash: string;
  action: string;
  entityTable: string;
  entityId: string;
  changedBy: string;
  beforeJson?: string;
  afterJson?: string;
  timestamp: number;
  ip?: string;
};

/**
 * JSON arrays preserve field order and avoid ambiguous string concatenation.
 * `beforeJson` / `afterJson` are signed verbatim so the audit value displayed
 * to an operator is the value protected by the chain.
 */
export function canonicalAuditChainPayload(payload: AuditChainPayload): string {
  return JSON.stringify([
    AUDIT_CHAIN_VERSION,
    payload.chainSequence,
    payload.prevHash,
    payload.action,
    payload.entityTable,
    payload.entityId,
    payload.changedBy,
    payload.beforeJson ?? null,
    payload.afterJson ?? null,
    payload.timestamp,
    payload.ip ?? null,
  ]);
}

export async function hashAuditChainPayload(payload: AuditChainPayload): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalAuditChainPayload(payload)),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export type SealedAuditEntry = AuditChainPayload & { hash: string };

export type AuditChainVerification = {
  valid: boolean;
  checkedEntries: number;
  issue?: "invalid_genesis" | "missing_link" | "invalid_sequence" | "invalid_hash";
};

/** Verify a chronological run of sealed entries. */
export async function verifyAuditChain(
  entries: SealedAuditEntry[],
  options: { requireGenesis?: boolean } = {},
): Promise<AuditChainVerification> {
  let previousHash: string | undefined;
  let previousSequence: number | undefined;

  for (const entry of entries) {
    if (previousHash === undefined && options.requireGenesis && entry.prevHash !== AUDIT_CHAIN_GENESIS) {
      return { valid: false, checkedEntries: entries.length, issue: "invalid_genesis" };
    }
    if (previousHash !== undefined && entry.prevHash !== previousHash) {
      return { valid: false, checkedEntries: entries.length, issue: "missing_link" };
    }
    if (previousSequence !== undefined && entry.chainSequence !== previousSequence + 1) {
      return { valid: false, checkedEntries: entries.length, issue: "invalid_sequence" };
    }
    if (await hashAuditChainPayload(entry) !== entry.hash) {
      return { valid: false, checkedEntries: entries.length, issue: "invalid_hash" };
    }
    previousHash = entry.hash;
    previousSequence = entry.chainSequence;
  }

  return { valid: true, checkedEntries: entries.length };
}
