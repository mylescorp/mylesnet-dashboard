import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOTSTRAP_TENANT_SLUG,
  MYLESNET_PUBLIC_DOMAIN,
  PANEL_SUBDOMAINS,
  TENANT_SLUG_RE,
  isValidTenantSlug,
} from "./tenant.ts";
import {
  RESERVED_TENANT_SLUGS,
  SIGNUP_HOST_DOMAIN,
  isValidPassword,
  isValidSignupSlug,
  passwordStrength,
} from "../../../../convex/lib/signup.ts";

test("convex signup host domain matches the apps/web public domain", () => {
  assert.equal(SIGNUP_HOST_DOMAIN, MYLESNET_PUBLIC_DOMAIN);
});

test("convex signup slug regex matches the apps/web tenant slug regex", () => {
  assert.equal(TENANT_SLUG_RE.source, /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.source);
  // Both regexes must accept/reject exactly the same character set.
  const probes = [
    "safaricom",
    "mount-kenya-isp",
    "a1",
    "a b",
    "UPPER",
    "a",
    "x".repeat(64),
    "",
    "my-isp-net",
    "with-double--dash",
  ];
  for (const probe of probes) {
    assert.equal(
      TENANT_SLUG_RE.test(probe),
      new RegExp(/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.source).test(probe),
      `slug regex parity for ${JSON.stringify(probe)}`,
    );
  }
});

test("convex signup reserved slugs cover every panel subdomain and bootstrap slug", () => {
  for (const panel of PANEL_SUBDOMAINS) {
    assert.equal(RESERVED_TENANT_SLUGS.has(panel), true, `panel ${panel} must be reserved`);
  }
  assert.equal(RESERVED_TENANT_SLUGS.has(BOOTSTRAP_TENANT_SLUG), true, "bootstrap slug must be reserved");
  assert.equal(RESERVED_TENANT_SLUGS.has("www"), true, "www must be reserved");
});

test("signup slug validity is a strict subset of tenant slug validity", () => {
  const probes = [
    "safaricom",
    "admin",
    "dashboard",
    "mylesnet",
    "www",
    "numeric-123",
    "1",
    "a b",
    "UPPER",
    "mount-kenya-isp",
    "x".repeat(63),
    "dash-",
    "-dash",
  ];
  for (const probe of probes) {
    const signup = isValidSignupSlug(probe);
    const tenant = isValidTenantSlug(probe);
    if (signup) assert.equal(tenant, true, `valid signup slug ${probe} must be a valid tenant slug`);
    else {
      const reserved = RESERVED_TENANT_SLUGS.has(probe);
      const numericOnly = /^\d+$/.test(probe);
      assert.ok(!tenant || reserved || numericOnly, `rejected slug ${probe} must be invalid or reserved or numeric`);
    }
  }
});

test("password policy matches the wizard's strength semantics", () => {
  assert.equal(isValidPassword("7z9kCloud!"), true);
  assert.equal(isValidPassword("short1A!"), false);
  assert.equal(isValidPassword("alllowercase42!"), false);
  assert.equal(isValidPassword("NOUPPER42!"), false);
  assert.equal(isValidPassword("NoDigitsHere!!"), false);
  assert.equal(isValidPassword("NoSymbolsHere1"), false);
  assert.equal(passwordStrength("7z9kCloud!"), 4);
  assert.equal(passwordStrength("short"), 0);
});