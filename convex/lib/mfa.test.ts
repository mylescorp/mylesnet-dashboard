import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MFA_ENFORCEMENT_MODE,
  MANDATORY_MFA_ROLES,
  assertMfaCompliance,
  isMfaCompliant,
  requiresMandatory2FA,
  unmetMfaRoles,
} from "./mfa.ts";

test("MFA is optional for every role", () => {
  assert.equal(MFA_ENFORCEMENT_MODE, "optional");
  assert.deepEqual(MANDATORY_MFA_ROLES, []);
});

test("requiresMandatory2FA is false for every role", () => {
  assert.equal(requiresMandatory2FA("platform_owner"), false);
  assert.equal(requiresMandatory2FA("platform_admin"), false);
  assert.equal(requiresMandatory2FA("ops_manager"), false);
  assert.equal(requiresMandatory2FA("finance_manager"), false);
  assert.equal(requiresMandatory2FA("platform_support"), false);
  assert.equal(requiresMandatory2FA("agent"), false);
  assert.equal(requiresMandatory2FA("network_operator"), false);
  assert.equal(requiresMandatory2FA(null), false);
  assert.equal(requiresMandatory2FA(undefined), false);
});

test("isMfaCompliant never blocks an optional MFA user", () => {
  assert.equal(isMfaCompliant(["platform_owner"], null), true);
  assert.equal(isMfaCompliant(["platform_admin"], {}), true);
  assert.equal(isMfaCompliant(["platform_owner"], { mfaEnrolledAt: 0 }), true);
  assert.equal(isMfaCompliant(["platform_owner"], {}), true);
  assert.equal(isMfaCompliant(["platform_owner"], { mfaEnrolledAt: 1750000000000 }), true);
});

test("isMfaCompliant is lax for roles outside the mandatory set", () => {
  assert.equal(isMfaCompliant(["agent"], null), true);
  assert.equal(isMfaCompliant(["platform_support"], null), true);
  assert.equal(isMfaCompliant([], null), true);
  assert.equal(isMfaCompliant(["network_operator"], null), true);
  assert.equal(isMfaCompliant(undefined, null), true);
});

test("unmetMfaRoles is empty in optional mode", () => {
  assert.deepEqual(unmetMfaRoles(["platform_owner"]), []);
  assert.deepEqual(unmetMfaRoles(["platform_support"]), []);
  assert.deepEqual(
    unmetMfaRoles(["platform_owner", "agent", "ops_manager"]),
    [],
  );
  assert.deepEqual(unmetMfaRoles([]), []);
});

test("guard is a no-op in optional mode", () => {
  assert.doesNotThrow(() =>
    assertMfaCompliance({ mfaEnrolled: false }, ["platform_admin"], { enforcementLevel: "full" }),
  );
  assert.doesNotThrow(() =>
    assertMfaCompliance({ mfaEnrolled: true, mfaEnrolledAt: 1750000000000 }, ["platform_admin"], { enforcementLevel: "full" }),
  );
  assert.doesNotThrow(() =>
    assertMfaCompliance({ mfaEnrolled: false }, ["platform_admin"], { shadowMode: true }),
  );
});
