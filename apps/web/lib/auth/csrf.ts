/**
 * CSRF protection core (pure, node/browser-safe).
 *
 * Implements the CSRF Protection standard for MylesNet's double-submit scheme:
 * one token per session stored in the `__mylesnet_csrf` cookie (httpOnly=false
 * by design, see cookies.ts), echoed back in the `X-CSRF-Token` header on every
 * state-changing request, verified server-side before any mutation, and rotated
 * after every successful use.
 *
 * These functions are pure so they can be unit-tested with `node --test`.
 * Route handlers and server actions compose them with the cookie/header readers
 * in `cookies.ts` and `session.ts`.
 */

export const CSRF_TOKEN_BYTES = 32;
export const CSRF_HEADER_NAME = "X-CSRF-Token";

/** URL-safe base64 alphabet, no padding. */
export function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/** Generate a new cryptographically random CSRF token (32 random bytes). */
export function generateCsrfToken(): string {
  const bytes = new Uint8Array(CSRF_TOKEN_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

/** True when the value looks like a token we generated (length + alphabet). */
export function isWellFormedCsrfToken(value: string | undefined | null): value is string {
  if (typeof value !== "string" || value.length < 16 || value.length > 128) return false;
  return /^[A-Za-z0-9_-]+$/.test(value);
}

/** Constant-time string comparison. Never throws on length mismatch. */
export function timingSafeEqualString(
  a: string | null | undefined,
  b: string | null | undefined,
): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/**
 * Verify a double-submit CSRF exchange. The cookie token and header token must
 * be present, well-formed, of equal length and compare constant-time equal.
 * Returns false (never throws) on any mismatch so callers can fail closed.
 */
export function verifyCsrfToken(
  cookieToken: string | undefined | null,
  headerToken: string | undefined | null,
): boolean {
  if (!isWellFormedCsrfToken(cookieToken) || !isWellFormedCsrfToken(headerToken)) {
    return false;
  }
  return timingSafeEqualString(cookieToken, headerToken);
}