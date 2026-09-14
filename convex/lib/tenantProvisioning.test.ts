import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeTenantRegistration } from "./tenantProvisioning.ts";

const valid = {
  name: "Example ISP",
  slug: "Example-ISP",
  country: "ke",
  timezone: "Africa/Nairobi",
  currency: "kes",
  workosOrganizationId: "org_01ABC123",
  ownerWorkosUserId: "user_01ABC123",
};

test("tenant registration normalizes only server-accepted values", () => {
  assert.deepEqual(normalizeTenantRegistration(valid), {
    ...valid,
    name: "Example ISP",
    slug: "example-isp",
    country: "KE",
    currency: "KES",
  });
});

test("tenant registration rejects malformed identity or tenant metadata", () => {
  assert.throws(() => normalizeTenantRegistration({ ...valid, slug: "bad slug" }), /slug/);
  assert.throws(() => normalizeTenantRegistration({ ...valid, workosOrganizationId: "not-an-org" }), /organization ID/);
  assert.throws(() => normalizeTenantRegistration({ ...valid, ownerWorkosUserId: "not-a-user" }), /owner user ID/);
});
