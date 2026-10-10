import assert from "node:assert/strict";
import { test } from "node:test";
import { inheritPlatformBranding, mergeTenantBranding } from "./workspaceBrandingCore.ts";

const defaults = { supportEmail: "help@example.test", supportPhone: "+254700000000", brandColor: "#123456" };

test("tenants without branding overrides inherit platform defaults", () => {
  assert.deepEqual(inheritPlatformBranding({}, defaults, "#FA8200"), defaults);
});

test("tenant branding overrides stay effective while missing values inherit", () => {
  assert.deepEqual(inheritPlatformBranding({ supportEmail: "tenant@example.test", brandColor: "#ABCDEF" }, defaults, "#FA8200"), {
    supportEmail: "tenant@example.test", supportPhone: defaults.supportPhone, brandColor: "#ABCDEF",
  });
});

test("explicitly selected fallback color remains a tenant override", () => {
  assert.equal(inheritPlatformBranding({ brandColor: "#FA8200", brandColorOverride: true }, defaults, "#FA8200").brandColor, "#FA8200");
});

test("ordinary saves preserve tenant overrides that equal current platform defaults", () => {
  const stored = { supportEmail: defaults.supportEmail, supportPhone: defaults.supportPhone, brandColor: defaults.brandColor, brandColorOverride: true };
  assert.deepEqual(mergeTenantBranding(stored, { ...stored, networkName: "Updated name" }, stored), stored);
});

test("brand color edits persist the submitted color rather than the inherited value", () => {
  const current = { supportEmail: "", supportPhone: "", brandColor: "#123456" };
  const saved = mergeTenantBranding({}, { brandColor: "#FA8200" }, current);
  assert.equal(saved.brandColor, "#FA8200");
  assert.equal(saved.brandColorOverride, true);
});

test("clearing a branding field explicitly removes its override", () => {
  const saved = mergeTenantBranding({ supportEmail: "tenant@example.test", brandColor: "#ABCDEF", brandColorOverride: true }, { supportEmail: "", brandColor: "" }, { supportEmail: "tenant@example.test", supportPhone: "", brandColor: "#ABCDEF" });
  assert.equal("supportEmail" in saved, false);
  assert.equal("brandColor" in saved, false);
  assert.equal("brandColorOverride" in saved, false);
});
