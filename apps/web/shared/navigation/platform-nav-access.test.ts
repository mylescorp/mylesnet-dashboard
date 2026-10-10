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
  assert.equal(canSeePlatformNavRoute("/platform/access", ["platform_support"]), true);
  assert.equal(canSeePlatformNavRoute("/platform/audit", ["platform_support"]), true);
});

test("canonical platform route scope takes precedence over legacy item roles", () => {
  // The canonical matrix grants owners billing access even when a legacy
  // navigation item only lists finance, and denies ops even if that item lists
  // owners. This prevents stale item-level roles from widening or narrowing
  // platform access inconsistently.
  assert.equal(
    canSeePlatformNavRoute("/platform/billing", ["platform_owner"], ["finance_manager"]),
    true,
  );
  assert.equal(
    canSeePlatformNavRoute("/platform/billing", ["ops_manager"], ["platform_owner"]),
    false,
  );

  // Unmapped routes continue to use the navigation item's fallback role list.
  assert.equal(
    canSeePlatformNavRoute("/platform/legacy-module", ["platform_owner"], ["finance_manager"]),
    false,
  );
  assert.equal(
    canSeePlatformNavRoute("/platform/legacy-module", ["finance_manager"], ["finance_manager"]),
    true,
  );
});

test("sidebar visibility matches representative canonical grants for all five sub-roles", () => {
  const roleCells: Array<{ role: string; expected: Record<string, boolean> }> = [
    {
      role: "platform_super_admin",
      expected: {
        "/platform/billing": true,
        "/platform/commissions/payouts": true,
        "/platform/infrastructure/devices": true,
        "/platform/analytics/tenant-health": true,
        "/platform/support": true,
        "/platform/security/data-requests": true,
        "/platform/agencies": true,
        "/platform/settings": true,
      },
    },
    {
      role: "platform_ops",
      expected: {
        "/platform/billing": false,
        "/platform/commissions/payouts": false,
        "/platform/infrastructure/devices": true,
        "/platform/analytics/tenant-health": false,
        "/platform/support": true,
        "/platform/security/data-requests": false,
        "/platform/agencies": true,
        "/platform/settings": true,
      },
    },
    {
      role: "platform_finance",
      expected: {
        "/platform/billing": true,
        "/platform/commissions/payouts": true,
        "/platform/infrastructure/devices": false,
        "/platform/analytics/tenant-health": false,
        "/platform/support": true,
        "/platform/security/data-requests": false,
        "/platform/agencies": true,
        "/platform/settings": false,
      },
    },
    {
      role: "platform_support",
      expected: {
        "/platform/billing": false,
        "/platform/commissions/payouts": false,
        "/platform/infrastructure/devices": true,
        "/platform/analytics/tenant-health": true,
        "/platform/support": true,
        "/platform/security/data-requests": true,
        "/platform/agencies": true,
        "/platform/settings": false,
      },
    },
    {
      role: "platform_readonly",
      expected: {
        "/platform/billing": true,
        "/platform/commissions/payouts": false,
        "/platform/infrastructure/devices": true,
        "/platform/analytics/tenant-health": false,
        "/platform/support": false,
        "/platform/security/data-requests": false,
        "/platform/agencies": false,
        "/platform/settings": false,
      },
    },
  ];

  for (const { role, expected } of roleCells) {
    for (const [route, visible] of Object.entries(expected)) {
      assert.equal(canSeePlatformNavRoute(route, [role]), visible, `${role} visibility for ${route}`);
    }
  }
});
