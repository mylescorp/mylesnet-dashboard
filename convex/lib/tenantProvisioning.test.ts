import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeAutomatedTenantOnboarding, normalizeTenantRegistration, tenantOrganizationExternalId } from "./tenantProvisioning.ts";

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
  assert.throws(() => normalizeTenantRegistration({ ...valid, slug: "admin" }), /workspace address/);
  assert.throws(() => normalizeTenantRegistration({ ...valid, workosOrganizationId: "not-an-org" }), /organization ID/);
  assert.throws(() => normalizeTenantRegistration({ ...valid, ownerWorkosUserId: "not-a-user" }), /owner user ID/);
});

test("automatic onboarding accepts only tenant details and normalizes the administrator email", () => {
  assert.deepEqual(normalizeAutomatedTenantOnboarding({
    name: " Example ISP ", slug: "Example-ISP", country: "ke", timezone: "Africa/Nairobi", currency: "kes",
    ownerEmail: " OWNER@EXAMPLE.COM ", ownerName: " Ada Owner ",
  }), {
    name: "Example ISP", slug: "example-isp", country: "KE", timezone: "Africa/Nairobi", currency: "KES",
    ownerEmail: "owner@example.com", ownerName: "Ada Owner",
  });
  assert.equal(tenantOrganizationExternalId("example-isp"), "mylesnet-tenant-example-isp");
  assert.throws(() => normalizeAutomatedTenantOnboarding({
    name: "Example ISP", slug: "example-isp", country: "KE", timezone: "Africa/Nairobi", currency: "KES", ownerEmail: "not-an-email",
  }), /administrator email/);
});

test("platform and public onboarding accept the same normalized workspace address", () => {
  const result = normalizeAutomatedTenantOnboarding({
    name: "Example ISP", slug: "  Two Words ISP  ", country: "ke", timezone: "Africa/Nairobi", currency: "kes",
    ownerEmail: "owner@example.com",
  });
  assert.equal(result.slug, "two-words-isp");
  assert.throws(() => normalizeAutomatedTenantOnboarding({
    ...result, slug: "dashboard",
  }), /workspace address/);
});
