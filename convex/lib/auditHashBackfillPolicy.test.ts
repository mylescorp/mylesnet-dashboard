import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const auditHashChain = readFileSync(new URL("../auditHashChain.ts", import.meta.url), "utf8");

test("legacy audit rows remain unsealed and cannot be rewritten by an audit hash migration", () => {
  assert.match(auditHashChain, /export const verifyAuditHashChain = query\(/);
  assert.doesNotMatch(auditHashChain, /runAuditHashBackfill|AUDIT_HASH_BACKFILL_RUN_ID/);
  assert.doesNotMatch(auditHashChain, /internalMutation|ctx\.db\.patch\(/);
});
