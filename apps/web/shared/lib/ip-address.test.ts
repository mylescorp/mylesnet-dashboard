import assert from "node:assert/strict";
import test from "node:test";
import { classifyAddress } from "./ip-address.ts";

test("classifies IPv4 ranges", () => {
  assert.equal(classifyAddress("203.0.113.7"), "public");
  assert.equal(classifyAddress("10.20.30.40"), "private");
  assert.equal(classifyAddress("172.16.0.1"), "private");
  assert.equal(classifyAddress("172.31.255.255"), "private");
  assert.equal(classifyAddress("192.168.1.10"), "private");
  assert.equal(classifyAddress("127.0.0.1"), "loopback");
  assert.equal(classifyAddress("169.254.10.1"), "link-local");
  assert.equal(classifyAddress("0.0.0.0"), "unknown");
});

test("treats 172.32 as public, not private", () => {
  assert.equal(classifyAddress("172.32.0.1"), "public");
  assert.equal(classifyAddress("172.15.0.1"), "public");
});

test("classifies IPv6 loopback in compressed and expanded spellings", () => {
  assert.equal(classifyAddress("::1"), "loopback");
  assert.equal(classifyAddress("0:0:0:0:0:0:0:1"), "loopback");
  assert.equal(classifyAddress("0000:0000:0000:0000:0000:0000:0000:0001"), "loopback");
});

test("classifies hexadecimal IPv4-mapped addresses by their IPv4 value", () => {
  assert.equal(classifyAddress("::ffff:7f00:1"), "loopback"); // 127.0.0.1
  assert.equal(classifyAddress("::ffff:127.0.0.1"), "loopback");
  assert.equal(classifyAddress("::ffff:192.168.1.5"), "private");
  assert.equal(classifyAddress("::ffff:203.0.113.9"), "public");
});

test("classifies the full fe80::/10 link-local range", () => {
  assert.equal(classifyAddress("fe80::1"), "link-local");
  assert.equal(classifyAddress("febf::1"), "link-local"); // top of fe80::/10
  assert.equal(classifyAddress("fec0::1"), "public"); // outside the range
});

test("classifies IPv6 unique local addresses", () => {
  assert.equal(classifyAddress("fc00::1"), "private");
  assert.equal(classifyAddress("fd12:3456::1"), "private");
  assert.equal(classifyAddress("fb00::1"), "public"); // outside fc00::/7
});

test("classifies a compressed public IPv6 address", () => {
  assert.equal(classifyAddress("2001:db8::1"), "public");
});

test("returns unknown for missing or malformed input", () => {
  assert.equal(classifyAddress(null), "unknown");
  assert.equal(classifyAddress(undefined), "unknown");
  assert.equal(classifyAddress(""), "unknown");
  assert.equal(classifyAddress("not-an-address"), "unknown");
  assert.equal(classifyAddress("::"), "unknown");
  assert.equal(classifyAddress("1.2.3"), "unknown");
  assert.equal(classifyAddress("1.2.3.999"), "unknown");
});
