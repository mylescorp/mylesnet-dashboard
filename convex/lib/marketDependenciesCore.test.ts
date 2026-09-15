import { test } from "node:test";
import assert from "node:assert/strict";
import { marketSoftDeleteBlockReason } from "./marketDependenciesCore.ts";

test("soft delete passes when there are no active dependents", () => {
  assert.equal(marketSoftDeleteBlockReason(0, 0, false), null);
});

test("soft delete passes when dependents exist but the cascade is forced", () => {
  assert.equal(marketSoftDeleteBlockReason(2, 1, true), null);
});

test("soft delete is blocked when active devices exist and no cascade is forced", () => {
  const reason = marketSoftDeleteBlockReason(1, 0, false);
  assert.ok(reason, "expected a block reason");
  assert.ok(reason.includes("1 active device(s)"));
});

test("soft delete is blocked when active assignments exist and no cascade is forced", () => {
  const reason = marketSoftDeleteBlockReason(0, 1, false);
  assert.ok(reason, "expected a block reason");
  assert.ok(reason.includes("1 active agent assignment(s)"));
});

test("the block reason names both dependent kinds", () => {
  const reason = marketSoftDeleteBlockReason(3, 4, false);
  assert.ok(reason && reason.includes("3 active device(s) and 4 active agent assignment(s)"));
});

test("soft delete is allowed when only one dependent kind is absent", () => {
  assert.equal(marketSoftDeleteBlockReason(0, 1, true), null);
  assert.equal(marketSoftDeleteBlockReason(1, 0, true), null);
});