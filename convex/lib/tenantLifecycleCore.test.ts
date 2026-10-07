import { test } from "node:test";
import assert from "node:assert/strict";
import { decideTenantLifecycleTransition } from "./tenantLifecycleCore.ts";

test("suspension remembers whether the tenant was trial or active", () => {
  assert.deepEqual(decideTenantLifecycleTransition("trial", "suspended"), { changed: true, status: "suspended", statusBeforeSuspension: "trial" });
  assert.deepEqual(decideTenantLifecycleTransition("active", "suspended"), { changed: true, status: "suspended", statusBeforeSuspension: "active" });
});

test("restoration returns a suspended tenant to its recorded lifecycle", () => {
  assert.deepEqual(decideTenantLifecycleTransition("suspended", "active", "trial"), { changed: true, status: "trial" });
  assert.deepEqual(decideTenantLifecycleTransition("suspended", "active", "active"), { changed: true, status: "active" });
  assert.deepEqual(decideTenantLifecycleTransition("suspended", "active"), { changed: true, status: "active" });
});

test("suspension cannot convert a provisioning or cancelled tenant", () => {
  assert.throws(() => decideTenantLifecycleTransition("provisioning", "suspended"), /Only trial or active/);
  assert.throws(() => decideTenantLifecycleTransition("cancelled", "suspended"), /Only trial or active/);
  assert.throws(() => decideTenantLifecycleTransition("cancelled", "active"), /cannot be restored/);
});

test("repeating the suspension is idempotent", () => {
  assert.deepEqual(decideTenantLifecycleTransition("suspended", "suspended", "trial"), { changed: false, status: "suspended", statusBeforeSuspension: "trial" });
});
