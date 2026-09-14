import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MANDATORY_MFA_ROLES,
  assertMfaCompliance,
  isMfaCompliant,
  requiresMandatory2FA,
  unmetMfaRoles,
} from "./mfa.ts";

test("MANDATORY_MFA_ROLES covers every privileged platform role", () => {
  assert.ok(MANDATORY_MFA_ROLES.includes("platform_owner"));
  assert.ok(MANDATORY_MFA_ROLES.includes("platform_admin"));
});

test("requiresMandatory2FA is true only for mandatory roles", () => {
  assert.equal(requiresMandatory2FA("platform_owner"), true);
  assert.equal(requiresMandatory2FA("platform_admin"), true);
  assert.equal(requiresMandatory2FA("ops_manager"), true);
  assert.equal(requiresMandatory2FA("finance_manager"), true);
  assert.equal(requiresMandatory2FA("platform_support"), false);
  assert.equal(requiresMandatory2FA("agent"), false);
  assert.equal(requiresMandatory2FA("network_operator"), false);
  assert.equal(requiresMandatory2FA(null), false);
  assert.equal(requiresMandatory2FA(undefined), false);
});

test("isMfaCompliant fails closed for mandatory roles without a marker", () => {
  assert.equal(isMfaCompliant(["platform_owner"], null), false);
  assert.equal(isMfaCompliant(["platform_admin"], {}), false);
  assert.equal(isMfaCompliant(["platform_owner"], { mfaEnrolledAt: 0 }), false);
  assert.equal(isMfaCompliant(["platform_owner"], {}), false);
  assert.equal(isMfaCompliant(["platform_owner"], { mfaEnrolledAt: 1750000000000 }), true);
});

test("isMfaCompliant is lax for roles outside the mandatory set", () => {
  assert.equal(isMfaCompliant(["agent"], null), true);
  assert.equal(isMfaCompliant(["platform_support"], null), true);
  assert.equal(isMfaCompliant([], null), true);
  assert.equal(isMfaCompliant(["network_operator"], null), true);
  assert.equal(isMfaCompliant(undefined, null), true);
});

test("unmetMfaRoles reports only the mandatory roles actually held", () => {
  assert.deepEqual(unmetMfaRoles(["platform_owner"]), ["platform_owner"]);
  assert.deepEqual(unmetMfaRoles(["platform_support"]), []);
  assert.deepEqual(
    unmetMfaRoles(["platform_owner", "agent", "ops_manager"]),
    ["platform_owner", "ops_manager"],
  );
  assert.deepEqual(unmetMfaRoles([]), []);
});

test("guard enforcement blocks mandatory roles without a synced MFA marker", () => {
  assert.throws(
    () => assertMfaCompliance({ mfaEnrolled: false }, ["platform_admin"], { enforcementLevel: "full" }),
    /multi-factor authentication is required/,
  );
  assert.doesNotThrow(() =>
    assertMfaCompliance({ mfaEnrolled: true, mfaEnrolledAt: 1750000000000 }, ["platform_admin"], { enforcementLevel: "full" }),
  );
  assert.doesNotThrow(() =>
    assertMfaCompliance({ mfaEnrolled: false }, ["platform_admin"], { shadowMode: true }),
  );
});
