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

const ENROLLED = { mfaEnrolled: true, mfaEnrolledAt: 1750000000000 };
const NOT_ENROLLED = { mfaEnrolled: false };

test("MFA is mandatory for every platform role", () => {
  assert.equal(MFA_ENFORCEMENT_MODE, "required");
  assert.deepEqual([...MANDATORY_MFA_ROLES].sort(), [
    "finance_manager",
    "ops_manager",
    "platform_admin",
    "platform_owner",
    "platform_support",
  ]);
});

test("requiresMandatory2FA is true for platform roles and false for the rest", () => {
  for (const slug of MANDATORY_MFA_ROLES) {
    assert.equal(requiresMandatory2FA(slug), true, slug);
  }
  assert.equal(requiresMandatory2FA("agent"), false);
  assert.equal(requiresMandatory2FA("network_operator"), false);
  assert.equal(requiresMandatory2FA("investor_viewer"), false);
  assert.equal(requiresMandatory2FA(null), false);
  assert.equal(requiresMandatory2FA(undefined), false);
});

test("isMfaCompliant fails closed for an unenrolled platform role", () => {
  assert.equal(isMfaCompliant(["platform_owner"], NOT_ENROLLED), false);
  assert.equal(isMfaCompliant(["platform_admin"], null), false);
  assert.equal(isMfaCompliant(["ops_manager", "agent"], NOT_ENROLLED), false);
  assert.equal(isMfaCompliant(["finance_manager"], {}), false);
  assert.equal(isMfaCompliant(["platform_support"], undefined), false);
});

test("isMfaCompliant passes once a factor is enrolled", () => {
  assert.equal(isMfaCompliant(["platform_owner"], ENROLLED), true);
  assert.equal(isMfaCompliant(["platform_admin"], { mfaEnrolledAt: 1750000000000 }), true);
  assert.equal(isMfaCompliant(["platform_owner", "agent"], ENROLLED), true);
});

test("isMfaCompliant does not block roles outside the mandatory set", () => {
  assert.equal(isMfaCompliant(["agent"], null), true);
  assert.equal(isMfaCompliant(["network_operator"], null), true);
  assert.equal(isMfaCompliant([], null), true);
  assert.equal(isMfaCompliant(undefined, null), true);
});

test("unmetMfaRoles lists only the mandatory platform roles without enrollment", () => {
  assert.deepEqual(unmetMfaRoles(["platform_owner"], NOT_ENROLLED), ["platform_owner"]);
  assert.deepEqual(
    unmetMfaRoles(["platform_owner", "agent", "ops_manager"], NOT_ENROLLED),
    ["platform_owner", "ops_manager"],
  );
  assert.deepEqual(unmetMfaRoles(["platform_owner"], ENROLLED), []);
  assert.deepEqual(unmetMfaRoles(["agent", "network_operator"], null), []);
  assert.deepEqual(unmetMfaRoles([], null), []);
});

test("guard throws only when a mandatory platform role is unenrolled", () => {
  assert.throws(() => assertMfaCompliance(NOT_ENROLLED, ["platform_admin"]));
  assert.throws(() => assertMfaCompliance(null, ["platform_owner", "platform_support"]));
  assert.doesNotThrow(() => assertMfaCompliance(ENROLLED, ["platform_owner"]));
  assert.doesNotThrow(() => assertMfaCompliance(null, ["agent", "network_operator"]));
  assert.doesNotThrow(() => assertMfaCompliance(NOT_ENROLLED, []));
});

test("shadow mode never blocks during an approved rollout transition", () => {
  assert.doesNotThrow(() =>
    assertMfaCompliance(NOT_ENROLLED, ["platform_admin"], { shadowMode: true }),
  );
  assert.doesNotThrow(() =>
    assertMfaCompliance(NOT_ENROLLED, ["platform_admin"], {
      shadowMode: true,
      enforcementLevel: "full",
    }),
  );
});
