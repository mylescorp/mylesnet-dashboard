import { randomFillSync } from "node:crypto";

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
  const body = await request.arrayBuffer();
  return Response.json(
    { received: body.byteLength },
    { headers: { "Cache-Control": "no-store" } }
  );
}
