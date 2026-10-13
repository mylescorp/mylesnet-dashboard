/**
 * Idempotency for money mutations.
 *
 * A payment is identified by the (gateway, reference) pair an operator already
 * treats as unique inside one tenant. Comparing that pair lets a retried
 * submission (a double click, or a client retry after a timeout) match the
 * first attempt instead of recording a second payment. Comparison trims
 * surrounding whitespace, so a row written before normalization still matches
 * its retry, and the tenant is part of the match so a reference can never
 * dedupe across tenants.
 */
export interface PaymentIdempotencyKey {
  gateway: string;
  reference: string;
}

export interface PaymentIdempotencyCandidate {
  tenantId?: string | null;
  gateway: string;
  reference: string;
}

/** Canonical form of the pair stored on a payment and used for lookups. */
export function normalizePaymentIdempotencyKey(
  key: PaymentIdempotencyKey,
): PaymentIdempotencyKey {
  return {
    gateway: key.gateway.trim(),
    reference: key.reference.trim(),
  };
}

/**
 * Whether an existing payment is the same record an incoming submission would
 * create. Requires the same tenant and equal trimmed gateway and reference.
 */
export function isSamePayment(
  candidate: PaymentIdempotencyCandidate,
  incoming: { tenantId: string } & PaymentIdempotencyKey,
): boolean {
  if (candidate.tenantId !== incoming.tenantId) return false;
  return (
    candidate.gateway.trim() === incoming.gateway.trim() &&
    candidate.reference.trim() === incoming.reference.trim()
  );
}

/** First candidate that is the same payment as the incoming submission, if any. */
export function findSamePayment<T extends PaymentIdempotencyCandidate>(
  candidates: readonly T[],
  incoming: { tenantId: string } & PaymentIdempotencyKey,
): T | null {
  return candidates.find((candidate) => isSamePayment(candidate, incoming)) ?? null;
}
