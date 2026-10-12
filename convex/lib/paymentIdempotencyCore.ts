/**
 * Idempotency for money mutations.
 *
 * A payment is identified by the (gateway, reference) pair an operator already
 * treats as unique inside one tenant. Normalizing that pair lets a retried
 * submission (a double click, or a client retry after a timeout) match the
 * first attempt instead of recording a second payment. Normalization only trims
 * surrounding whitespace, so it can never change the value an operator typed.
 */
export interface PaymentIdempotencyKey {
  gateway: string;
  reference: string;
}

/** Canonical form of the pair used to match a retried payment submission. */
export function normalizePaymentIdempotencyKey(
  key: PaymentIdempotencyKey,
): PaymentIdempotencyKey {
  return {
    gateway: key.gateway.trim(),
    reference: key.reference.trim(),
  };
}
