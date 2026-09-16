import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_CHAIN_GENESIS,
  canonicalAuditChainPayload,
  hashAuditChainPayload,
  verifyAuditChain,
  type AuditChainPayload,
} from "./auditChainCore.ts";

const first: AuditChainPayload = {
  chainSequence: 1,
  prevHash: AUDIT_CHAIN_GENESIS,
  action: "tenant.suspend",
  entityTable: "tenants",
  entityId: "tenant-1",
  changedBy: "user-1",
  beforeJson: '{"status":"active"}',
  afterJson: '{"status":"suspended"}',
  timestamp: 1_726_320_000_000,
};

test("audit hash uses one deterministic canonical payload", async () => {
  assert.equal(
    canonicalAuditChainPayload(first),
    '[1,1,"mylesnet:audit-chain:v1:genesis","tenant.suspend","tenants","tenant-1","user-1","{\\"status\\":\\"active\\"}","{\\"status\\":\\"suspended\\"}",1726320000000,null]',
  );
  assert.equal(
    await hashAuditChainPayload(first),
    "17eb15c4ada65da7f1ffde85f706f0488e5fcd4c6e0c4145e972dcd86c218231",
  );
});

test("audit hash verifier detects altered content and broken links", async () => {
  const firstHash = await hashAuditChainPayload(first);
  const second: AuditChainPayload = {
    ...first,
    chainSequence: 2,
    prevHash: firstHash,
    action: "tenant.resume",
    timestamp: first.timestamp + 1,
  };
  const secondHash = await hashAuditChainPayload(second);

  assert.deepEqual(await verifyAuditChain([{ ...first, hash: firstHash }, { ...second, hash: secondHash }]), {
    valid: true,
    checkedEntries: 2,
  });
  assert.equal((await verifyAuditChain([{ ...first, hash: firstHash }, { ...second, afterJson: "{}", hash: secondHash }])).issue, "invalid_hash");
  assert.equal((await verifyAuditChain([{ ...first, hash: firstHash }, { ...second, prevHash: AUDIT_CHAIN_GENESIS, hash: secondHash }])).issue, "missing_link");
  assert.equal((await verifyAuditChain([{ ...first, prevHash: "unexpected", hash: firstHash }], { requireGenesis: true })).issue, "invalid_genesis");
});
