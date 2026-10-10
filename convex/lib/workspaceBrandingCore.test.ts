import assert from "node:assert/strict";
import { test } from "node:test";
import { inheritPlatformBranding } from "./workspaceBrandingCore.ts";

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
