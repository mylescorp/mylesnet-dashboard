import { test } from "node:test";
import assert from "node:assert/strict";
import { resolveAuditTenantId } from "./auditTenantCore.ts";

test("an explicit tenant id always wins over the authenticated tenant", () => {
  assert.equal(
    resolveAuditTenantId({ explicitTenantId: "ten_explicit", authenticatedTenantId: "ten_auth" }),
    "ten_explicit",
  );
});

test("an explicit null stays null (deliberate platform or global row)", () => {
  assert.equal(
    resolveAuditTenantId({ explicitTenantId: null, authenticatedTenantId: "ten_auth" }),
    null,
  );
});

test("an unset explicit id falls back to the authenticated tenant", () => {
  assert.equal(
    resolveAuditTenantId({ explicitTenantId: undefined, authenticatedTenantId: "ten_auth" }),
    "ten_auth",
  );
});

test("no explicit id and no mapped organization yields no tenant scope", () => {
  assert.equal(
    resolveAuditTenantId({ explicitTenantId: undefined, authenticatedTenantId: null }),
    null,
  );
  assert.equal(
    resolveAuditTenantId({ explicitTenantId: undefined, authenticatedTenantId: undefined }),
    null,
  );
});

test("an unmapped organization never falls back to a bootstrap tenant", () => {
  // The authenticated resolver returns null for an unmapped or malformed org
  // claim; the writer must leave the row unscoped rather than guess.
  assert.equal(
    resolveAuditTenantId({ explicitTenantId: undefined, authenticatedTenantId: null }),
    null,
  );
});
