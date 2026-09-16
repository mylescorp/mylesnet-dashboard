import { test } from "node:test";
import assert from "node:assert/strict";
import { hasPanelAccess } from "./panelAccess.ts";

test("panel access maps current WorkOS system and organization role slugs", () => {
  assert.equal(hasPanelAccess(["platform_admin"], "platform"), true);
  assert.equal(hasPanelAccess(["platform_super_admin"], "platform"), true);
  assert.equal(hasPanelAccess(["org-platform_admin"], "platform"), true);
  assert.equal(hasPanelAccess(["org-client_admin"], "admin"), true);
  assert.equal(hasPanelAccess(["agent"], "dashboard"), true);
  assert.equal(hasPanelAccess(["network_operator"], "network"), true);
});

test("panel access denies roles outside the requested panel", () => {
  assert.equal(hasPanelAccess(["agent"], "platform"), false);
  assert.equal(hasPanelAccess(["platform_support"], "dashboard"), false);
  assert.equal(hasPanelAccess([], "admin"), false);
});
