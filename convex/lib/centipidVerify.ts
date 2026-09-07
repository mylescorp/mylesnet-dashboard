/**
 * Pure, dependency-free helpers for Centipid webhook signature verification,
 * payload mapping, and MCP response parsing. No Convex imports so they can be
 * unit-tested with node:test.
 */

export type CentipidEventCategory = "subscriber" | "payment" | "voucher" | "ticket";

const KNOWN_PREFIXES = ["subscriber.", "payment.", "voucher.", "ticket."];

export function bytesConstantTimeEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
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

function hexToBytes(hex: string): Uint8Array | null {
  const normalized = hex.trim();
  if (normalized.length === 0 || normalized.length % 2 !== 0 || /[^0-9a-f]/i.test(normalized)) {
    return null;
  }
  const bytes = new Uint8Array(normalized.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = parseInt(normalized.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function base64ToBytes(value: string): Uint8Array | null {
  try {
    const binary = atob(value.trim());
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return null;
  }
}

/**
 * Reduce an arbitrary `X-…-Signature` header shape to a single signature value.
 * Supports the common `t=…,v1=…` comma format, `sha256=` / `v1=` prefixes, and
 * bare hex or base64 values.
 */
export function extractSignatureValue(header: string | null | undefined): string | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;

  if (trimmed.includes(",") && /(^|,)\s*(t|v0|v1|sig|signature)\s*=/.test(trimmed)) {
    const candidates: Array<{ key: string; value: string }> = [];
    for (const part of trimmed.split(",")) {
      const [key, value] = part.split("=", 2);
      const normalizedKey = (key ?? "").trim().toLowerCase();
      const candidate = (value ?? "").trim();
      if (candidate) candidates.push({ key: normalizedKey, value: candidate });
    }
    const preferred = candidates.find(
      ({ key }) => key === "v1" || key === "signature" || key === "sig",
    );
    return (preferred ?? candidates.find(({ key }) => key === "v0"))?.value ?? null;
  }

  const bare = trimmed.replace(/^sha256=/i, "").replace(/^v[01]=/i, "").trim();
  return bare || null;
}

/** Constant-time check of an HMAC-SHA256 signature over the raw body. */
export async function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): Promise<boolean> {
  const expected = extractSignatureValue(signatureHeader);
  if (!expected) return false;

  const digestHex = await hmacSha256Hex(secret, rawBody);
  const digestBytes = hexToBytes(digestHex);
  if (!digestBytes) return false;

  const hexCandidate = hexToBytes(expected);
  if (hexCandidate && bytesConstantTimeEqual(hexCandidate, digestBytes)) return true;

  const base64Candidate = base64ToBytes(expected);
  if (base64Candidate && bytesConstantTimeEqual(base64Candidate, digestBytes)) return true;

  return false;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

export function pickString(payload: unknown, keys: string[]): string {
  const record = asRecord(payload);
  if (!record) return "";
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return "";
}

/**
 * The envelope records of an incoming payload in lookup order: the top-level
 * object first, then the common nested containers providers use (`data`,
 * `payload`, `event`, `object`). Duplicate containers are skipped.
 */
export function collectEntityRecords(payload: unknown): Array<Record<string, unknown>> {
  const direct = asRecord(payload);
  if (!direct) return [];
  const records: Array<Record<string, unknown>> = [direct];
  const seen = new Set<Record<string, unknown>>([direct]);
  for (const key of ["data", "payload", "event", "object"]) {
    const nested = asRecord(direct[key]);
    if (nested && !seen.has(nested)) {
      seen.add(nested);
      records.push(nested);
    }
  }
  return records;
}

/** Best-effort extraction of the Centipid event type from an unknown payload. */
export function extractEventType(payload: unknown): string | null {
  const candidate = collectEntityRecords(payload)
    .map((record) => pickString(record, ["event_type", "eventType", "event", "type", "name"]))
    .find((value) => value.length > 0);
  if (!candidate) return null;
  const normalized = candidate.trim();
  return KNOWN_PREFIXES.some((prefix) => normalized.startsWith(prefix)) ? normalized : null;
}

/**
 * Content-based fallback for deliveries whose event type is absent or outside
 * the known namespaces. Classifies a payload by its distinctive fields so an
 * unrecognized-but-recognizable change still lands in the activity stream as
 * `{category}.unknown` instead of being ignored. Returns null when the payload
 * matches nothing.
 */
export function inferCentipidEvent(
  payload: unknown,
): { category: CentipidEventCategory; eventType: string } | null {
  const records = collectEntityRecords(payload);
  const get = (...keys: string[]) =>
    records.map((record) => pickString(record, keys)).find((value) => value.length > 0) ?? "";

  const amount = get("amount", "value", "price", "total");
  const method = get("method", "channel", "payment_method", "receipt", "reference", "transaction_id", "transactionId", "payment_id");
  if (amount && method) return { category: "payment", eventType: "payment.unknown" };

  const voucherCode = get("code", "voucher_code", "voucherCode", "voucher_id", "batch_id");
  const packageName = get("package_name", "packageName", "package", "plan");
  if (voucherCode && packageName) return { category: "voucher", eventType: "voucher.unknown" };

  const subject = get("subject", "title");
  const ticketSignal = get("status", "priority", "category", "ticket_id");
  if (subject && (ticketSignal || records.length > 1)) {
    return { category: "ticket", eventType: "ticket.unknown" };
  }

  const phone = get("phone", "mobile", "msisdn");
  const subscriberSignal = get("subscriber_id", "subscriberId", "username", "account", "expiry", "expires_at", "expiry_date", "package_name", "packageName", "package", "plan");
  if (phone || subscriberSignal) return { category: "subscriber", eventType: "subscriber.unknown" };

  return null;
}

export function classifyEvent(
  payload: unknown,
): { category: CentipidEventCategory | null; eventType: string | null } {
  const eventType = extractEventType(payload);
  if (!eventType) return { category: null, eventType: null };
  const namespace = eventType.split(".")[0] ?? "";
  const category: CentipidEventCategory | null =
    namespace === "subscriber" || namespace === "payment" || namespace === "voucher" || namespace === "ticket"
      ? (namespace as CentipidEventCategory)
      : null;
  return { category, eventType };
}

/** Best-effort extraction of a webhook event id used for idempotent delivery. */
export function extractWebhookEventId(payload: unknown): string | null {
  const candidate = collectEntityRecords(payload)
    .map((record) => pickString(record, ["webhook_event_id", "webhookEventId", "event_id", "eventId", "uuid", "id"]))
    .find((value) => value.length > 0);
  return candidate || null;
}

/**
 * Parse a monetized string such as "UGX 1,000.00" or "5000" into a numeric
 * amount plus its currency. Numeric values pass through unchanged.
 */
export function parseAmountDisplay(value: unknown): { amount: number; currency: string } {
  if (typeof value === "number") {
    return { amount: Number.isFinite(value) ? value : 0, currency: "UGX" };
  }
  const text = String(value ?? "").trim();
  const match = text.match(/^([A-Za-z]{2,4})\s*([\d,]+(?:\.\d+)?)$/);
  if (match) {
    const amount = Number(match[2].replace(/,/g, ""));
    return { amount: Number.isFinite(amount) ? amount : 0, currency: match[1].toUpperCase() };
  }
  const amount = Number(text.replace(/[^\d.-]/g, ""));
  return { amount: Number.isFinite(amount) ? amount : 0, currency: "UGX" };
}

/**
 * Resolve a Centipid timestamp to epoch milliseconds. Accepts epoch numbers,
 * ISO-8601 strings, and the space-separated "YYYY-MM-DD HH:MM:SS" format the
 * platform emits. Returns undefined when nothing can be parsed.
 */
export function parseCentipidTimestamp(value: unknown): number | undefined {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  const text = String(value ?? "").trim();
  if (!text) return undefined;
  // Strings carrying an explicit zone indicator (Z or ±HH:MM) are exact; let
  // Date.parse resolve them. Naive "YYYY-MM-DD[ T]HH:MM(:SS)" strings are the
  // platform's local-workspace time, so construct them in the server's zone.
  if (/[zZ]|[+-]\d{1,2}:?\d{2}$/.test(text)) {
    const zoned = Date.parse(text);
    return Number.isFinite(zoned) ? zoned : undefined;
  }
  const dateMatch = text.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/);
  if (dateMatch) {
    const stamped = new Date(
      Number(dateMatch[1]),
      Number(dateMatch[2]) - 1,
      Number(dateMatch[3]),
      Number(dateMatch[4]),
      Number(dateMatch[5]),
      Number(dateMatch[6] ?? 0),
    ).getTime();
    return Number.isFinite(stamped) ? stamped : undefined;
  }
  const iso = Date.parse(text);
  return Number.isFinite(iso) ? iso : undefined;
}

/**
 * Parse an MCP server text response: plain JSON, or JSON-RPC delivered as
 * SSE `data:` frames (the shape `mcp.centipidbilling.com/mcp` answers with).
 */
export function parseMcpResponse(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed.startsWith("data:")) {
    return JSON.parse(trimmed);
  }
  let payload = "";
  for (const line of trimmed.split("\n")) {
    const dataLine = line.trim();
    if (dataLine.startsWith("data:")) {
      const value = dataLine.slice(5).trim();
      if (value !== "[DONE]") payload = value;
    }
  }
  return JSON.parse(payload);
}

/** Extract the `content[].text` values from a parsed MCP `tools/call` result. */
export function mcpTextContents(result: unknown): string[] {
  const record = asRecord(result);
  if (!record) return [];
  const content = Array.isArray(record.content) ? record.content : asRecord(record.result)?.content;
  if (!Array.isArray(content)) return [];
  return content
    .map((item) => {
      const itemRecord = asRecord(item);
      if (!itemRecord) return null;
      return itemRecord.type === "text" && typeof itemRecord.text === "string"
        ? itemRecord.text
        : null;
    })
    .filter((item): item is string => item !== null);
}