import { test } from "node:test";
import assert from "node:assert/strict";
import { allowSpeedTestUpload } from "./speedtest-upload-rate-limit.ts";

test("speed-test upload throttles repeated requests per client window", () => {
  const key = `client-${Date.now()}-${Math.random()}`;
  const startedAt = Date.now();
  assert.equal(allowSpeedTestUpload(key, startedAt), true);
  assert.equal(allowSpeedTestUpload(key, startedAt + 1), true);
  assert.equal(allowSpeedTestUpload(key, startedAt + 2), true);
  assert.equal(allowSpeedTestUpload(key, startedAt + 3), false);
  assert.equal(allowSpeedTestUpload(key, startedAt + 60_001), true);
});
