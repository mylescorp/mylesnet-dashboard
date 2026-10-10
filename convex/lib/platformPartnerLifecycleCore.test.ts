import { test } from "node:test";
import assert from "node:assert/strict";
import { planPartnerRestore, planPartnerSuspend } from "./platformPartnerLifecycleCore.ts";

test("partner suspension marks active descendants under the initiating root", () => {
  const result = planPartnerSuspend({ id: "root", status: "active" }, [
    { id: "client-link", status: "active" },
    { id: "independently-suspended", status: "suspended" },
  ]);
  assert.equal(result.rootPatch.status, "suspended");
  assert.deepEqual(result.descendantPatches, [{ id: "client-link", patch: { status: "suspended", statusBeforeSuspension: "active", suspendedByRelationshipId: "root" } }]);
  assert.throws(() => planPartnerSuspend({ id: "root", status: "suspended" }, []), /active relationship/);
});

test("restore reverses only descendant suspensions owned by this root", () => {
  const result = planPartnerRestore({ id: "root", status: "suspended", statusBeforeSuspension: "active" }, [
    { id: "ours", status: "suspended", statusBeforeSuspension: "active", suspendedByRelationshipId: "root" },
    { id: "other", status: "suspended", statusBeforeSuspension: "active", suspendedByRelationshipId: "other-root" },
    { id: "active", status: "active" },
  ]);
  assert.equal(result.rootPatch.status, "active");
  assert.deepEqual(result.descendantPatches.map(row => row.id), ["ours"]);
  assert.throws(() => planPartnerRestore({ id: "root", status: "active" }, []), /suspended relationship/);
});
