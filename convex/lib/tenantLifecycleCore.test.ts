/**
 * Tests for the tenant retention-lifecycle guards (A3). Pure node:test,
 * mirrors tenantCore.test.ts / marketDependenciesCore.test.ts.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  TENANT_RETENTION_WINDOW_MS,
  assertCanPurge,
  assertCanRequestDeletion,
  assertCanRestore,
  purgeEligibleAt,
  retentionDaysRemaining,
} from "./tenantLifecycleCore.ts";
import type { TenantLifecycleState } from "./tenantLifecycleCore.ts";

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.UTC(2026, 8, 15); // "now" for every relative assertion

function tenant(overrides: Partial<TenantLifecycleState>): TenantLifecycleState {
  return { status: "active", ...overrides };
}

describe("purgeEligibleAt", () => {
  it("opens exactly the retention window after the request", () => {
    assert.equal(purgeEligibleAt(NOW), NOW + TENANT_RETENTION_WINDOW_MS);
  });
});

describe("retentionDaysRemaining", () => {
  it("reports whole days remaining before the window elapses", () => {
    const t = tenant({
      status: "pending_deletion",
      purgeEligibleAt: NOW + 29 * DAY,
    });
    assert.equal(retentionDaysRemaining(t, NOW), 29);
  });

  it("floors to zero once the window has elapsed", () => {
    const t = tenant({
      status: "pending_deletion",
      purgeEligibleAt: NOW - 1,
    });
    assert.equal(retentionDaysRemaining(t, NOW), 0);
  });

  it("returns 0 when no window exists", () => {
    assert.equal(retentionDaysRemaining(tenant({}), NOW), 0);
  });
});

describe("assertCanRequestDeletion", () => {
  it("allows the window to open from trial, active and suspended", () => {
    for (const status of ["trial", "active", "suspended"] as const) {
      assert.doesNotThrow(() => assertCanRequestDeletion(tenant({ status })));
    }
  });

  it("rejects a tenant already pending deletion", () => {
    assert.throws(
      () => assertCanRequestDeletion(tenant({ status: "pending_deletion" })),
      /already in progress/,
    );
  });

  it("rejects a cancelled tenant", () => {
    assert.throws(
      () => assertCanRequestDeletion(tenant({ status: "cancelled" })),
      /retention workflow/,
    );
  });

  it("rejects an offboarded tenant", () => {
    assert.throws(
      () => assertCanRequestDeletion(tenant({ status: "active", deletedAt: NOW })),
      /already offboarded/,
    );
  });
});

describe("assertCanRestore", () => {
  it("restores a suspended tenant", () => {
    assert.doesNotThrow(() => assertCanRestore(tenant({ status: "suspended" })));
  });

  it("restores a pending-deletion tenant", () => {
    assert.doesNotThrow(() =>
      assertCanRestore(tenant({ status: "pending_deletion" })),
    );
  });

  it("rejects restore of an active or trial tenant (nothing to restore)", () => {
    for (const status of ["trial", "active"] as const) {
      assert.throws(() => assertCanRestore(tenant({ status })), /not in a restorable state/);
    }
  });

  it("rejects restore of a cancelled tenant", () => {
    assert.throws(
      () => assertCanRestore(tenant({ status: "cancelled" })),
      /cannot be restored/,
    );
  });

  it("rejects restore of an offboarded tenant", () => {
    assert.throws(
      () => assertCanRestore(tenant({ status: "pending_deletion", deletedAt: NOW })),
      /already offboarded/,
    );
  });
});

describe("assertCanPurge", () => {
  it("allows purge exactly at the retention-window boundary", () => {
    const t = tenant({
      status: "pending_deletion",
      purgeEligibleAt: NOW + TENANT_RETENTION_WINDOW_MS,
    });
    assert.doesNotThrow(() =>
      assertCanPurge(t, t.purgeEligibleAt!),
    );
  });

  it("denies purge while the window is still open", () => {
    const t = tenant({
      status: "pending_deletion",
      purgeEligibleAt: NOW + 10 * DAY,
    });
    assert.throws(
      () => assertCanPurge(t, NOW),
      /Retention window not elapsed: 10 day\(s\) remaining/,
    );
  });

  it("denies purge of a tenant that never requested deletion", () => {
    assert.throws(
      () => assertCanPurge(tenant({ status: "pending_deletion" }), NOW),
      /no purge window/,
    );
  });

  it("denies purge of a tenant not pending deletion", () => {
    assert.throws(
      () => assertCanPurge(tenant({ status: "suspended" }), NOW),
      /Only tenants pending deletion/,
    );
  });

  it("denies purge of an offboarded tenant", () => {
    assert.throws(
      () => assertCanPurge(tenant({ status: "pending_deletion", deletedAt: NOW }), NOW),
      /already offboarded/,
    );
  });
});