import assert from "node:assert/strict";
import { test } from "node:test";
import { organizationIdFromWorkosIdentity } from "./workosIdentity.ts";

test("organizationIdFromWorkosIdentity reads the WorkOS custom JWT org_id claim", () => {
  assert.equal(organizationIdFromWorkosIdentity({ org_id: "org_01ABC123" }), "org_01ABC123");
});

test("organizationIdFromWorkosIdentity rejects absent and malformed claims", () => {
  assert.equal(organizationIdFromWorkosIdentity({}), undefined);
  assert.equal(organizationIdFromWorkosIdentity({ org_id: "tenant_01ABC123" }), undefined);
  assert.equal(organizationIdFromWorkosIdentity({ org_id: ["org_01ABC123"] }), undefined);
});
