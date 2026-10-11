import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveMembershipSync, shouldApplyMembershipDeletion, shouldApplyMembershipProviderEvent } from "./platformMembershipSyncCore.ts";

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

test("replacement membership event applies when its provider timestamp is newer", () => {
  assert.equal(shouldApplyMembershipProviderEvent("old-id", "new-id", 10, 20, false), true);
});

test("late events for an old membership cannot replace the current provider identity", () => {
  assert.equal(shouldApplyMembershipProviderEvent("new-id", "old-id", 20, 10, false), false);
});

test("different membership IDs without timestamps require an explicit prior deletion", () => {
  assert.equal(shouldApplyMembershipProviderEvent("old-id", "new-id", undefined, undefined, false), false);
  assert.equal(shouldApplyMembershipProviderEvent("old-id", "new-id", undefined, undefined, true), true);
});

test("same-ID events without timestamps cannot undo a recorded deletion", () => {
  assert.equal(shouldApplyMembershipProviderEvent("same-id", "same-id", 20, undefined, true), false);
});

test("membership deletion applies only to the currently recorded provider membership", () => {
  assert.equal(shouldApplyMembershipDeletion("current-id", "current-id", 20, 21), true);
  assert.equal(shouldApplyMembershipDeletion("current-id", "old-id", 20, 30), false);
  assert.equal(shouldApplyMembershipDeletion(undefined, "old-id", undefined, 30), false);
});

test("stale deletion timestamps do not revoke the matching membership", () => {
  assert.equal(shouldApplyMembershipDeletion("same-id", "same-id", 30, 20), false);
});
