/**
 * Pure, dependency-free helpers for WorkOS webhook signature verification.
 * No Convex imports so it can be unit-tested with node:test.
 *
 * WorkOS signs deliveries with an HMAC-SHA256 over `<timestamp>.<raw_body>`
 * using the webhook endpoint's signing secret, and sends it in the
 * `WorkOS-Signature` header as `t=<timestamp>,v1=<hex>`.
 */

export const WORKOS_SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000;

export interface WorkosSignatureParts {
  timestamp: number | null;
  signature: string | null;
}

/** Parse `t=…,v1=…` from the WorkOS-Signature header. */
export function parseWorkosSignatureHeader(
  header: string | null | undefined,
): WorkosSignatureParts {
  if (!header) return { timestamp: null, signature: null };
  let timestamp: number | null = null;
  let signature: string | null = null;
  for (const part of header.split(",")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();
    if (!value) continue;
    if (key === "t") {
      const parsed = Number(value);
      timestamp = Number.isFinite(parsed) ? parsed * 1000 : null;
    } else if (key === "v1") {
      signature = value;
    }
  }
  return { timestamp, signature };
}

export async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export function hexBytesEqual(leftHex: string, rightHex: string): boolean {
  if (leftHex.length !== rightHex.length) return false;
  let difference = 0;
  for (let index = 0; index < leftHex.length; index += 1) {
    difference |= (leftHex.charCodeAt(index) ^ rightHex.charCodeAt(index)) & 0xff;
  }
  return difference === 0;
}

/**
 * Verify a WorkOS webhook delivery: freshness (default 5 minutes) and an
 * HMAC-SHA256 over `t.<rawPayload>`.
 */
export async function verifyWorkosWebhook(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
  now = Date.now(),
  toleranceMs = WORKOS_SIGNATURE_TOLERANCE_MS,
): Promise<boolean> {
  const { timestamp, signature } = parseWorkosSignatureHeader(signatureHeader);
  if (timestamp === null || !signature) return false;
  if (Math.abs(now - timestamp) > toleranceMs) return false;

  const expected = await hmacSha256Hex(secret, `${Math.floor(timestamp / 1000)}.${rawBody}`);
  return hexBytesEqual(expected, signature.toLowerCase());
}

/** Extract the top-level event name WorkOS delivers (dotted, e.g. user.created). */
export function extractWorkosEvent(rawBody: string): string | null {
  try {
    const payload = JSON.parse(rawBody) as { event?: unknown };
    return typeof payload.event === "string" && payload.event ? payload.event : null;
  } catch {
    return null;
  }
}