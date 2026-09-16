import assert from "node:assert/strict";
import test from "node:test";
import {
  AUDIT_CHAIN_GENESIS,
  hashAuditChainPayload,
  type AuditChainPayload,
} from "./auditChainCore.ts";
import {
  newVerifyState,
  nextVerifyState,
  verifyIssueFor,
  verifyStateFromManifest,
  verifyStateToManifest,
  type AuditChainVerifyRow,
} from "./auditChainVerifyCore.ts";

const base: AuditChainPayload = {
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

async function sealed(payload: AuditChainPayload): Promise<AuditChainVerifyRow & { hash: string }> {
  return {
    hash: await hashAuditChainPayload(payload),
    prevHash: payload.prevHash,
    chainSequence: payload.chainSequence,
    action: payload.action,
    entityTable: payload.entityTable,
    entityId: payload.entityId,
    changedBy: payload.changedBy,
    beforeJson: payload.beforeJson,
    afterJson: payload.afterJson,
    timestamp: payload.timestamp,
    ip: payload.ip,
  };
}

const legacy: AuditChainVerifyRow = {
  action: "tenant.create",
  entityTable: "tenants",
  entityId: "tenant-0",
  changedBy: "user-0",
  timestamp: 1_000_000_000,
};

test("verification state starts fresh and round-trips through the manifest", () => {
  const fresh = newVerifyState();
  assert.equal(fresh.lastChainSequence, 0);
  assert.equal(fresh.checkedEntries, 0);
  assert.equal(fresh.issue, null);

  const restored = verifyStateFromManifest(verifyStateToManifest({ ...fresh, checkedEntries: 3, lastChainSequence: 3 }));
  assert.equal(restored.checkedEntries, 3);
  assert.equal(restored.lastChainSequence, 3);
  assert.equal(verifyStateFromManifest({}).lastChainSequence, 0);
});

test("full sealed chain verifies and carries across batch boundaries", async () => {
  const first = { ...base, chainSequence: 1, prevHash: AUDIT_CHAIN_GENESIS };
  const secondHash = await hashAuditChainPayload({ ...first, chainSequence: 2, prevHash: (await sealed(first)).hash, action: "tenant.resume", timestamp: first.timestamp + 1 });
  const thirdHash = await hashAuditChainPayload({ ...first, chainSequence: 3, prevHash: secondHash, action: "tenant.suspend", timestamp: first.timestamp + 2 });

  // Batch 1 sweeps entries 1-2 (legacy row first), then the manifest is
  // persisted and restored before batch 2 — proving resume keeps linking.
  const batch1 = await nextVerifyState(await nextVerifyState(await nextVerifyState(newVerifyState(), legacy), await sealed(first)), {
    ...(await sealed({ ...first, chainSequence: 2, prevHash: (await sealed(first)).hash, action: "tenant.resume", timestamp: first.timestamp + 1 })),
  });
  assert.equal(batch1.issue, null);
  assert.equal(batch1.legacySkipped, 1);
  assert.equal(batch1.checkedEntries, 2);

  const resumed = verifyStateFromManifest(verifyStateToManifest(batch1));
  const batch2 = await nextVerifyState(resumed, {
    hash: thirdHash,
    prevHash: secondHash,
    chainSequence: 3,
    action: "tenant.suspend",
    entityTable: "tenants",
    entityId: "tenant-1",
    changedBy: "user-1",
    beforeJson: '{"status":"active"}',
    afterJson: '{"status":"suspended"}',
    timestamp: first.timestamp + 2,
  });
  assert.equal(batch2.issue, null);
  assert.equal(batch2.checkedEntries, 3);
  assert.equal(batch2.firstSequence, 1);
  assert.equal(batch2.lastSequence, 3);
  assert.equal(batch2.startsAt, first.timestamp);
  assert.equal(batch2.endsAt, first.timestamp + 2);
});

test("unsealed legacy rows are skipped and counted, never linked", async () => {
  const first = await sealed(base);
  const state = await nextVerifyState(await nextVerifyState(newVerifyState(), legacy), first);
  assert.equal(state.issue, null);
  assert.equal(state.legacySkipped, 1);
  assert.equal(state.firstSequence, 1);
});

test("genesis is enforced on the first sealed row", async () => {
  const wrongSeq = await sealed({ ...base, chainSequence: 2 });
  assert.equal(verifyIssueFor(wrongSeq, newVerifyState()), "invalid_genesis");
  assert.equal((await nextVerifyState(newVerifyState(), wrongSeq)).issue, "invalid_genesis");

  const wrongPrev = await sealed({ ...base, prevHash: "evil-hash" });
  assert.equal(verifyIssueFor(wrongPrev, newVerifyState()), "invalid_genesis");
});

test("sequence gaps break the chain", async () => {
  const first = await sealed(base);
  const gap = await sealed({ ...base, chainSequence: 3, prevHash: (await sealed(base)).hash });
  const state = await nextVerifyState(await nextVerifyState(newVerifyState(), first), gap);
  assert.equal(state.issue, "invalid_sequence");
});

test("rewritten link target is a missing-link failure", async () => {
  const first = await sealed(base);
  const secondOriginal = await sealed({ ...base, chainSequence: 2, prevHash: first.hash! });
  const next = { ...secondOriginal, prevHash: "stale-hash" };
  const state = await nextVerifyState(await nextVerifyState(newVerifyState(), first), next);
  assert.equal(state.issue, "missing_link");
});

test("tampered content is detected as an invalid hash", async () => {
  const first = await sealed(base);
  const secondOriginal = await sealed({ ...base, chainSequence: 2, prevHash: first.hash!, action: "tenant.resume" });
  const tampered = { ...secondOriginal, afterJson: '{"status":"hacked"}' };
  const state = await nextVerifyState(await nextVerifyState(newVerifyState(), first), tampered);
  assert.equal(state.issue, "invalid_hash");
});

test("walk continues after the first issue so coverage stays complete", async () => {
  const first = await sealed(base);
  const tampered = { ...(await sealed({ ...base, chainSequence: 2, prevHash: first.hash! })), afterJson: '{"status":"hacked"}' };
  const third = await sealed({ ...base, chainSequence: 3, prevHash: (await sealed({ ...base, chainSequence: 2, prevHash: first.hash! })).hash! });
  const state = await nextVerifyState(
    await nextVerifyState(await nextVerifyState(newVerifyState(), first), tampered),
    third,
  );
  assert.equal(state.issue, "invalid_hash");
  assert.equal(state.checkedEntries, 3);
  assert.equal(state.lastSequence, 3);
});