import { test } from "node:test";
import assert from "node:assert/strict";
import { planPartnerRestore, planPartnerSuspend, shouldTraverseRelationshipForCycle } from "./platformPartnerLifecycleCore.ts";

test("cycle validation excludes the relationship being replaced but keeps other active edges", () => {
  assert.equal(shouldTraverseRelationshipForCycle({ id: "edited-edge" }, "edited-edge"), false);
  assert.equal(shouldTraverseRelationshipForCycle({ id: "other-edge" }, "edited-edge"), true);
  assert.equal(shouldTraverseRelationshipForCycle({ id: "archived-edge", deletedAt: 1 }, "edited-edge"), false);
});

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
