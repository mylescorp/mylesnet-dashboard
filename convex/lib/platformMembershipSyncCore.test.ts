import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMembershipSync } from "./platformMembershipSyncCore.ts";

test("provider observations cannot override a newer revoked access intent", () => {
  assert.deepEqual(resolveMembershipSync("revoked", "active"), { status: "revoked", clearOverride: false });
});

test("provider observations cannot override a newer active access intent", () => {
  assert.deepEqual(resolveMembershipSync("active", "revoked"), { status: "active", clearOverride: false });
});

test("matching provider state confirms and clears the manual override", () => {
  assert.deepEqual(resolveMembershipSync("revoked", "revoked", 20, 20), { status: "revoked", clearOverride: true });
});

test("stale or unordered provider events cannot clear a newer override", () => {
  assert.deepEqual(resolveMembershipSync("revoked", "revoked", 20, 19), { status: "revoked", clearOverride: false });
  assert.deepEqual(resolveMembershipSync("revoked", "revoked", 20), { status: "revoked", clearOverride: false });
});

test("provider state remains authoritative when no manual override exists", () => {
  assert.deepEqual(resolveMembershipSync(undefined, "pending"), { status: "pending", clearOverride: false });
});
