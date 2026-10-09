import { test } from "node:test";
import assert from "node:assert/strict";
import { POST } from "../../app/api/speedtest/route.ts";

test("speed-test upload counts streamed bytes without buffering the full request", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(1024));
      controller.enqueue(new Uint8Array(2048));
      controller.close();
    },
  });
  const response = await POST(new Request("https://example.test/api/speedtest?op=upload", { method: "POST", body, duplex: "half" } as RequestInit & { duplex: "half" }));
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { received: 3072 });
});

test("speed-test upload rejects an oversized declared body", async () => {
  const response = await POST(new Request("https://example.test/api/speedtest?op=upload", {
    method: "POST",
    headers: { "content-length": String(9 * 1024 * 1024) },
  }));
  assert.equal(response.status, 413);
});

test("speed-test upload rejects an oversized streamed body", async () => {
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(6 * 1024 * 1024));
      controller.enqueue(new Uint8Array(3 * 1024 * 1024));
    },
  });
  const response = await POST(new Request("https://example.test/api/speedtest?op=upload", { method: "POST", body, duplex: "half" } as RequestInit & { duplex: "half" }));
  assert.equal(response.status, 413);
});
