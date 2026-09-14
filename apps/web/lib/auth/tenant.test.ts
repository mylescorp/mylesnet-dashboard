import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BOOTSTRAP_TENANT_SLUG,
  MYLESNET_PUBLIC_DOMAIN,
  PANEL_SUBDOMAINS,
  callbackUriForHost,
  isApexHost,
  isPanelHost,
  isValidTenantSlug,
  normalizeHost,
  resolveMylesnetHost,
  tenantSlugFromHost,
} from "./tenant.ts";

test("normalizeHost strips protocol, port, path and leading www", () => {
  assert.equal(normalizeHost("https://Admin.mylesnet.com:3000"), "admin.mylesnet.com");
  assert.equal(normalizeHost("http://cloud.example.com/a?b=1"), "cloud.example.com");
  assert.equal(normalizeHost("tenant.mylesnet.com:8443"), "tenant.mylesnet.com");
  assert.equal(normalizeHost("www.tenant.mylesnet.com"), "tenant.mylesnet.com");
  assert.equal(normalizeHost("localhost"), "localhost");
  assert.equal(normalizeHost(""), "");
  assert.equal(normalizeHost(undefined), "");
});

test("PANEL_SUBDOMAINS covers the canonical panel map", () => {
  assert.deepEqual([...PANEL_SUBDOMAINS], ["admin", "network", "dashboard", "reseller", "agency", "partner"]);
});

test("isPanelHost recognizes reserved panel hosts", () => {
  assert.equal(isPanelHost(`admin.${MYLESNET_PUBLIC_DOMAIN}`), true);
  assert.equal(isPanelHost(`network.${MYLESNET_PUBLIC_DOMAIN}`), true);
  assert.equal(isPanelHost(`dashboard.${MYLESNET_PUBLIC_DOMAIN}`), true);
  assert.equal(isPanelHost(`foo.${MYLESNET_PUBLIC_DOMAIN}`), false);
  assert.equal(isPanelHost("localhost"), false);
  assert.equal(isPanelHost("mylesnet.com"), false);
});

test("isApexHost recognizes apex, localhost and bare hosts", () => {
  assert.equal(isApexHost(MYLESNET_PUBLIC_DOMAIN), true);
  assert.equal(isApexHost("localhost"), true);
  assert.equal(isApexHost("127.0.0.1"), true);
  assert.equal(isApexHost(`admin.${MYLESNET_PUBLIC_DOMAIN}`), true); // panel host has no tenant
  assert.equal(isApexHost(`tenant.${MYLESNET_PUBLIC_DOMAIN}`), false);
});

test("isValidTenantSlug enforces slug shape", () => {
  assert.equal(isValidTenantSlug("safaricom"), true);
  assert.equal(isValidTenantSlug("mount-kenya-isp"), true);
  assert.equal(isValidTenantSlug("a1"), true);
  assert.equal(isValidTenantSlug("a b"), false);
  assert.equal(isValidTenantSlug("UPPER"), false);
  assert.equal(isValidTenantSlug("a"), false);
  assert.equal(isValidTenantSlug("x".repeat(64)), false);
  assert.equal(isValidTenantSlug(""), false);
  assert.equal(isValidTenantSlug(undefined), false);
});

test("tenantSlugFromHost resolves the tenant subdomain", () => {
  assert.equal(tenantSlugFromHost(`safaricom.${MYLESNET_PUBLIC_DOMAIN}`), "safaricom");
  assert.equal(tenantSlugFromHost(`Mount-Kenya.${MYLESNET_PUBLIC_DOMAIN}:3000`), "mount-kenya");
  assert.equal(tenantSlugFromHost(`admin.${MYLESNET_PUBLIC_DOMAIN}`), null);
  assert.equal(tenantSlugFromHost(MYLESNET_PUBLIC_DOMAIN), null);
  assert.equal(tenantSlugFromHost("localhost"), null);
  assert.equal(tenantSlugFromHost("127.0.0.1"), null);
  assert.equal(tenantSlugFromHost(""), null);
  assert.equal(tenantSlugFromHost("attacker.example.com"), null);
  assert.equal(tenantSlugFromHost(`nested.tenant.${MYLESNET_PUBLIC_DOMAIN}`), null);
});

test("canonical resolver only permits approved apex, panel, and single-label tenant hosts", () => {
  assert.deepEqual(resolveMylesnetHost(MYLESNET_PUBLIC_DOMAIN), { kind: "apex", hostname: MYLESNET_PUBLIC_DOMAIN });
  assert.deepEqual(resolveMylesnetHost(`admin.${MYLESNET_PUBLIC_DOMAIN}`), { kind: "panel", hostname: `admin.${MYLESNET_PUBLIC_DOMAIN}`, panel: "admin" });
  assert.deepEqual(resolveMylesnetHost(`safaricom.${MYLESNET_PUBLIC_DOMAIN}`), { kind: "tenant", hostname: `safaricom.${MYLESNET_PUBLIC_DOMAIN}`, tenantSlug: "safaricom" });
  assert.equal(resolveMylesnetHost("evil.example.com").kind, "unknown");
  assert.equal(resolveMylesnetHost(`www.${MYLESNET_PUBLIC_DOMAIN}`).kind, "unknown");
  assert.equal(callbackUriForHost(resolveMylesnetHost(`admin.${MYLESNET_PUBLIC_DOMAIN}`)), `https://admin.${MYLESNET_PUBLIC_DOMAIN}/auth/callback`);
});

test("development hosts keep their port so the callback matches WorkOS redirects", () => {
  assert.deepEqual(resolveMylesnetHost("localhost:3000"), { kind: "development", hostname: "localhost", port: "3000" });
  assert.deepEqual(resolveMylesnetHost("127.0.0.1:3000"), { kind: "development", hostname: "127.0.0.1", port: "3000" });
  assert.deepEqual(resolveMylesnetHost("localhost"), { kind: "development", hostname: "localhost" });
  assert.equal(callbackUriForHost(resolveMylesnetHost("localhost:3000"), "http:"), "http://localhost:3000/auth/callback");
  assert.equal(callbackUriForHost(resolveMylesnetHost("localhost"), "http:"), "http://localhost/auth/callback");
  // Non-development hosts never carry a port into the callback URI.
  assert.equal(callbackUriForHost(resolveMylesnetHost(`safaricom.${MYLESNET_PUBLIC_DOMAIN}:8443`)), `https://safaricom.${MYLESNET_PUBLIC_DOMAIN}/auth/callback`);
});

test("BOOTSTRAP_TENANT_SLUG matches the convex bootstrap fallback", () => {
  assert.equal(BOOTSTRAP_TENANT_SLUG, "mylesnet");
});
