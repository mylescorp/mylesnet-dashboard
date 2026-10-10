import { createHash, randomFillSync } from "node:crypto";
import { allowSpeedTestUpload } from "../../../shared/lib/speedtest-upload-rate-limit.ts";

/**
 * Speed-test payload endpoint.
 *
 * `GET ?op=ping` measures round-trip time with a tiny JSON body;
 * `GET ?op=download&bytes=N` streams N bytes of incompressible data;
 * `POST ?op=upload` counts the bytes it receives. Everything is generated in
 * process — no external test service, no storage — so the numbers describe
 * this server, not a carrier-grade CDN. Responses are never cached.
 */

const CHUNK_BYTES = 1 << 20; // 1 MiB per stream step
const MIN_BYTES = 64 * 1024;
const MAX_BYTES = 64 * (1 << 20);
const DEFAULT_BYTES = 10 * (1 << 20);
const MAX_UPLOAD_BYTES = 8 * (1 << 20);

const NO_STORE = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
  "Content-Type": "application/octet-stream",
} as const;

const clampBytes = (raw: string | null): number => {
  const requested = Number(raw);
  if (!Number.isFinite(requested)) return DEFAULT_BYTES;
  return Math.min(MAX_BYTES, Math.max(MIN_BYTES, Math.round(requested)));
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const op = searchParams.get("op");

  if (op === "ping") {
    return Response.json(
      { t: Date.now() },
      { headers: { "Cache-Control": "no-store" } }
    );
  }

  const total = clampBytes(searchParams.get("bytes"));
  let remaining = total;
  const chunk = new Uint8Array(CHUNK_BYTES);

  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (remaining <= 0) {
        controller.close();
        return;
      }
      const take = Math.min(CHUNK_BYTES, remaining);
      randomFillSync(chunk, 0, take);
      // `slice` copies, so the enqueued window is never rewritten underneath
      // the reader while the next chunk is being generated.
      controller.enqueue(chunk.slice(0, take));
      remaining -= take;
    },
  });

  return new Response(stream, {
    headers: {
      ...NO_STORE,
      "Content-Length": String(total),
    },
  });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_UPLOAD_BYTES) {
    return Response.json({ success: false, message: "Upload exceeds the allowed size." }, { status: 413, headers: { "Cache-Control": "no-store" } });
  }
  const clientAddress = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown-client";
  const clientKey = createHash("sha256").update(clientAddress).digest("hex");
  if (!allowSpeedTestUpload(clientKey)) {
    return Response.json(
      { success: false, message: "Please wait before running another upload test." },
      { status: 429, headers: { "Cache-Control": "no-store", "Retry-After": "60" } },
    );
  }
  if (!request.body) {
    return Response.json({ received: 0 }, { headers: { "Cache-Control": "no-store" } });
  }
  const reader = request.body.getReader();
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_UPLOAD_BYTES) {
      await reader.cancel();
      return Response.json({ success: false, message: "Upload exceeds the allowed size." }, { status: 413, headers: { "Cache-Control": "no-store" } });
    }
  }
  return Response.json(
    { received },
    { headers: { "Cache-Control": "no-store" } }
  );
}
