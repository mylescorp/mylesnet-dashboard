import { test } from "node:test";
import assert from "node:assert/strict";
import {
  assertNoClientOverride,
  assertTenantMatch,
  canTenantOperate,
  decideTenantAccess,
  isClientTenantOverride,
  isTenantActive,
  isTenantSuspended,
  resolvedTenantOrNull,
  selectBootstrapOwner,
  tenantMembershipStatusFromWorkos,
} from "./tenantCore.ts";

test("resolveTenantFromAuth's candidate resolver denies unresolved identities instead of selecting another tenant", () => {
  assert.equal(resolvedTenantOrNull(undefined, undefined), null);
  assert.equal(resolvedTenantOrNull(null, null), null);
  assert.equal(resolvedTenantOrNull("tenant_from_org", "bootstrap_tenant"), "tenant_from_org");
  assert.equal(resolvedTenantOrNull(undefined, "bootstrap_tenant"), "bootstrap_tenant");
});

test("bootstrapTenant owner selection refuses an empty or ownerless database before tenant creation", () => {
  assert.equal(selectBootstrapOwner([]), null);
  assert.equal(
    selectBootstrapOwner([{ _id: "deleted-owner", platformRole: "platform_owner", deletedAt: 1 }]),
    null,
  );
  assert.equal(
    selectBootstrapOwner([{ _id: "inactive-owner", platformRole: "platform_owner", isActive: false }]),
    null,
  );
  assert.equal(
    selectBootstrapOwner([{ _id: "owner", platformRole: "platform_owner" }])?._id,
    "owner",
  );
});

test("WorkOS membership removal maps to a revoked local tenant membership", () => {
  assert.equal(tenantMembershipStatusFromWorkos("active"), "active");
  assert.equal(tenantMembershipStatusFromWorkos("pending"), "pending");
  assert.equal(tenantMembershipStatusFromWorkos("inactive"), "revoked");
});

test("isTenantActive accepts trial and active only", () => {
  assert.equal(isTenantActive("trial"), true);
  assert.equal(isTenantActive("active"), true);
  assert.equal(isTenantActive("provisioning"), false);
  assert.equal(isTenantActive("suspended"), false);
  assert.equal(isTenantActive("cancelled"), false);
  assert.equal(isTenantActive(undefined), false);
});

test("isTenantSuspended flags only suspended", () => {
  assert.equal(isTenantSuspended("suspended"), true);
  assert.equal(isTenantSuspended("active"), false);
  assert.equal(isTenantSuspended("cancelled"), false);
});

test("canTenantOperate blocks unverified provisioning and inactive lifecycles", () => {
  assert.equal(canTenantOperate("provisioning"), false);
  assert.equal(canTenantOperate("trial"), true);
  assert.equal(canTenantOperate("active"), true);
  assert.equal(canTenantOperate("suspended"), false);
  assert.equal(canTenantOperate("cancelled"), false);
  // Unset status (pre-backfill rows) must not cut off legacy behavior.
  assert.equal(canTenantOperate(undefined), true);
});

test("assertNoClientOverride allows matching or absent client ids", () => {
  assert.doesNotThrow(() => assertNoClientOverride("ten_a", "ten_a", "vouchers"));
  assert.doesNotThrow(() => assertNoClientOverride("ten_a", undefined, "vouchers"));
  assert.doesNotThrow(() => assertNoClientOverride("ten_a", null, "vouchers"));
  // No resolved tenancy yet → pre-tenancy requests are not an override.
  assert.doesNotThrow(() => assertNoClientOverride(null, "ten_a", "vouchers"));
});

test("assertNoClientOverride denies a mismatched client-supplied tenant id", () => {
  assert.throws(
    () => assertNoClientOverride("ten_a", "ten_b", "vouchers"),
    /client-supplied tenantId is not authority/,
  );
});

test("assertTenantMatch allows global resources and same-tenant resources", () => {
  assert.doesNotThrow(() => assertTenantMatch("ten_a", undefined, "exchangeRates"));
  assert.doesNotThrow(() => assertTenantMatch("ten_a", null, "exchangeRates"));
  assert.doesNotThrow(() => assertTenantMatch("ten_a", "ten_a", "routers"));
});

test("assertTenantMatch denies cross-tenant access", () => {
  assert.throws(
    () => assertTenantMatch("ten_a", "ten_b", "routers"),
    /Cross-tenant denial/,
  );
  assert.throws(
    () => assertTenantMatch(null, "ten_a", "routers"),
    /actor has no tenant scope/,
  );
});

test("isClientTenantOverride mirrors the guard decision", () => {
  assert.equal(isClientTenantOverride("ten_a", "ten_b"), true);
  assert.equal(isClientTenantOverride("ten_a", "ten_a"), false);
  assert.equal(isClientTenantOverride("ten_a", undefined), false);
  assert.equal(isClientTenantOverride(null, "ten_a"), false);
});

test("decideTenantAccess covers suspended, global, and cross-tenant paths", () => {
  assert.equal(decideTenantAccess("ten_a", "ten_a", true).allowed, false);
  assert.equal(decideTenantAccess("ten_a", undefined, false).allowed, true);
  assert.equal(decideTenantAccess(null, "ten_a", false).allowed, false);
  assert.equal(decideTenantAccess("ten_a", "ten_b", false).allowed, false);
  assert.equal(decideTenantAccess("ten_a", "ten_a", false).allowed, true);
});
