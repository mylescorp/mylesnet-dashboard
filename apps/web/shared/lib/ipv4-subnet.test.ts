import { test } from "node:test";
import assert from "node:assert/strict";
import { firstUsableAddress } from "./ipv4-subnet.ts";

test("a /31 point-to-point range starts at the network address", () => {
  assert.equal(firstUsableAddress(0x0a000000, 31), 0x0a000000);
});

test("a /32 host range starts at its single address", () => {
  assert.equal(firstUsableAddress(0xc0a80101, 32), 0xc0a80101);
});

test("ordinary subnet ranges begin after the network address", () => {
  assert.equal(firstUsableAddress(0xc0a80100, 24), 0xc0a80101);
});
