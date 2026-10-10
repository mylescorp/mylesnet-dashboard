import assert from "node:assert/strict";
import { test } from "node:test";
import { canSeePlatformNavRoute } from "./platform-nav-access.ts";

test("platform owner has sidebar access to every owner-authorized module route", () => {
  const routes = [
    "/platform/organizations", "/platform/subscriptions", "/platform/billing",
    "/platform/billing/plans", "/platform/billing/reconciliation", "/platform/billing/anomalies",
    "/platform/commissions", "/platform/commissions/rates", "/platform/commissions/payouts",
    "/platform/analytics", "/platform/analytics/leaderboard", "/platform/infrastructure/devices",
    "/platform/infrastructure/health", "/platform/infrastructure/radius",
    "/platform/infrastructure/provisioning-queue", "/platform/infrastructure/policy-templates",
    "/platform/vouchers/packages", "/platform/vouchers/monitor", "/platform/agencies",
    "/platform/resellers", "/platform/support", "/platform/support/sla", "/platform/access",
    "/platform/users/directory", "/platform/audit", "/platform/security", "/platform/api-keys",
    "/platform/security/data-requests", "/platform/settings/white-label", "/platform/settings",
    "/platform/feature-flags",
  ];
  for (const route of routes) {
    assert.equal(canSeePlatformNavRoute(route, ["platform_owner"]), true, `${route} should be visible to platform owner`);
    assert.equal(canSeePlatformNavRoute(route, ["org-platform_owner"]), true, `${route} should be visible to org-scoped platform owner`);
  }
});

test("sidebar route scopes follow the platform sub-role grants", () => {
  assert.equal(canSeePlatformNavRoute("/platform/billing", ["finance_manager"]), true);
  assert.equal(canSeePlatformNavRoute("/platform/billing", ["ops_manager"]), false);
  assert.equal(canSeePlatformNavRoute("/platform/infrastructure/health", ["ops_manager"]), true);
  assert.equal(canSeePlatformNavRoute("/platform/infrastructure/devices", ["finance_manager"]), false);
  assert.equal(canSeePlatformNavRoute("/platform/security/data-requests", ["platform_support"]), true);
  assert.equal(canSeePlatformNavRoute("/platform/security/data-requests", ["platform_readonly"]), false);
});
