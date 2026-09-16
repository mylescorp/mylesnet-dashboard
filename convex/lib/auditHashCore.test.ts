import test from "node:test";
import assert from "node:assert/strict";
import {
  canonicalAuditString,
  computeAuditHash,
  sha256Hex,
  verifyAuditChain,
  type AuditChainRow,
} from "./auditHashCore.ts";

function row(overrides: Partial<AuditChainRow> = {}): AuditChainRow {
  return {
    id: "audit1",
    action: "market.statusChange",
    entityTable: "markets",
    entityId: "market1",
    changedBy: "user1",
    timestamp: 1_700_000_000_000,
    afterJson: '{"status":"active"}',
    ...overrides,
  };
}

/** Build a 3-row linked chain from scratch (mirrors the writer's contract). */
async function buildChain(): Promise<AuditChainRow[]> {
  const chain: AuditChainRow[] = [];
  for (let i = 0; i < 3; i += 1) {
    const base = row({
      id: `audit-${i}`,
      action: `action.${i}`,
      entityTable: "markets",
      entityId: `market-${i}`,
      changedBy: "user1",
      timestamp: 1_700_000_000_000 + i * 1000,
      afterJson: JSON.stringify({ status: `state-${i}` }),
    });
    const hash = await computeAuditHash({
      prevHash: chain.length > 0 ? chain[chain.length - 1]!.hash ?? "" : "",
      action: base.action,
      entityTable: base.entityTable,
      entityId: base.entityId,
      changedBy: base.changedBy,
      timestamp: base.timestamp,
      afterJson: base.afterJson ?? "",
    });
    chain.push({
      ...base,
      prevHash: chain.length > 0 ? chain[chain.length - 1]!.hash ?? "" : undefined,
      hash,
    });
  }
  return chain;
}

test("sha256Hex produces the expected 64-char digest", async () => {
  // SHA-256("abc") — well-known test vector.
  assert.equal(
    await sha256Hex("abc"),
    "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
  );
});

test("canonicalAuditString is deterministic and includes every hashed field", () => {
  const fields = {
    prevHash: "abc",
    action: "d",
    entityTable: "e",
    entityId: "f",
    changedBy: "g",
    timestamp: 123,
    afterJson: '{"h":1}',
  };
  const first = canonicalAuditString(fields);
  assert.equal(first, canonicalAuditString({ ...fields }));
  assert.ok(first.includes("abc"));
  assert.ok(first.includes("123"));
  // afterJson is a JSON string, so it is escaped inside the outer array.
  assert.ok(first.includes(String.raw`{\"h\":1}`));
});

test("computeAuditHash returns a stable hex digest", async () => {
  const fields = {
    prevHash: "",
    action: "a",
    entityTable: "b",
    entityId: "c",
    changedBy: "d",
    timestamp: 42,
    afterJson: "",
  };
  const hash = await computeAuditHash(fields);
  assert.match(hash, /^[0-9a-f]{64}$/);
  assert.equal(hash, await computeAuditHash(fields));
});

test("a contiguous chain verifies as valid", async () => {
  const chain = await buildChain();
  const result = await verifyAuditChain(chain);
  assert.equal(result.valid, true);
  assert.equal(result.total, 3);
  assert.equal(result.linked, 2);
  assert.deepEqual(result.mismatches, []);
});

test("an empty chain trivially verifies", async () => {
  const result = await verifyAuditChain([]);
  assert.equal(result.valid, true);
  assert.equal(result.total, 0);
});

test("a single genesis row with no prevHash and a valid hash verifies", async () => {
  const [only] = await buildChain();
  assert.ok(only);
  const result = await verifyAuditChain([only]);
  assert.equal(result.valid, true);
  assert.equal(result.linked, 0);
});

test("a genesis row that claims a prevHash is rejected", async () => {
  const [genesis] = await buildChain();
  assert.ok(genesis);
  const result = await verifyAuditChain([{ ...genesis, prevHash: "sneaky" }]);
  assert.equal(result.valid, false);
  assert.equal(result.mismatches[0]!.kind, "broken_link");
});

test("tampering with a row's payload breaks its own hash", async () => {
  const chain = await buildChain();
  chain[1] = {
    ...chain[1]!,
    afterJson: '{"status":"active","backdoor":true}',
  };
  const result = await verifyAuditChain(chain);
  assert.equal(result.valid, false);
  const badHash = result.mismatches.find((m) => m.kind === "bad_hash");
  assert.ok(badHash);
  assert.equal(badHash.id, "audit-1");
});

test("tampering with a middle row breaks the link into the next row", async () => {
  const chain = await buildChain();
  // Re-hash row 1 against a NEW payload, keeping prevHash intact — this makes
  // row 1 self-consistent but breaks the link from row 2.
  const recomputed = await computeAuditHash({
    prevHash: chain[0]!.hash ?? "",
    action: chain[1]!.action,
    entityTable: chain[1]!.entityTable,
    entityId: chain[1]!.entityId,
    changedBy: chain[1]!.changedBy,
    timestamp: chain[1]!.timestamp,
    afterJson: '{"status":"forged"}',
  });
  chain[1] = { ...chain[1]!, afterJson: '{"status":"forged"}', hash: recomputed };
  const result = await verifyAuditChain(chain);
  assert.equal(result.valid, false);
  const broken = result.mismatches.find((m) => m.kind === "broken_link");
  assert.ok(broken);
  assert.equal(broken.id, "audit-2");
});

test("pre-backfill rows with no hash/prevHash are honestly reported, not silently accepted", async () => {
  const rows = [row({ id: "audit-0" }), row({ id: "audit-1", action: "action.1" })];
  const result = await verifyAuditChain(rows);
  assert.equal(result.valid, false);
  const kinds = result.mismatches.map((m) => m.kind);
  assert.ok(kinds.includes("missing_hash"));
  assert.ok(kinds.includes("missing_prev"));
});

test("the same input always yields a byte-identical chain", async () => {
  const first = await buildChain();
  const second = await buildChain();
  assert.equal(first[0]!.hash, second[0]!.hash);
  assert.equal(first[2]!.hash, second[2]!.hash);
});