import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isFlagEnabledForTenant,
  rolloutPercentOf,
  parseFlagValue,
} from "./featureFlagCore.ts";

const flag = (overrides: {
  key?: string;
  enabled?: boolean;
  tenantIds?: string[];
  valueJson?: string;
}) => ({
  key: overrides.key ?? "print_preview",
  enabled: overrides.enabled ?? true,
  tenantIds: overrides.tenantIds,
  valueJson: overrides.valueJson,
});

test("a disabled flag is off for everyone, regardless of rollouts or overrides", () => {
  assert.equal(isFlagEnabledForTenant(flag({ enabled: false }), "tenantA"), false);
  assert.equal(
    isFlagEnabledForTenant(flag({ enabled: false, tenantIds: ["tenantA"] }), "tenantA"),
    false,
  );
  assert.equal(
    isFlagEnabledForTenant(flag({ enabled: false, valueJson: '{"rolloutPercent": 100}' }), "tenantA"),
    false,
  );
  assert.equal(isFlagEnabledForTenant(flag({ enabled: false }), undefined), false);
});

test("tenant-ids override only admits listed tenants", () => {
  const f = flag({ tenantIds: ["tenantA", "tenantB"] });
  assert.equal(isFlagEnabledForTenant(f, "tenantA"), true);
  assert.equal(isFlagEnabledForTenant(f, "tenantB"), true);
  assert.equal(isFlagEnabledForTenant(f, "tenantC"), false);
  assert.equal(isFlagEnabledForTenant(f, undefined), false);
  assert.equal(isFlagEnabledForTenant(f, null), false);
});

test("an empty tenant-ids list is treated as no override (global flag)", () => {
  assert.equal(isFlagEnabledForTenant(flag({ tenantIds: [] }), "tenantA"), true);
  assert.equal(isFlagEnabledForTenant(flag({ tenantIds: [] }), undefined), true);
});

test("percentage rollout is deterministic per (key, tenant)", () => {
  const f = flag({ valueJson: '{"rolloutPercent": 100}' });
  const g = flag({ valueJson: '{"rolloutPercent": 0}' });
  for (let i = 0; i < 50; i++) {
    assert.equal(isFlagEnabledForTenant(f, `tenant${i}`), true);
    assert.equal(isFlagEnabledForTenant(g, `tenant${i}`), false);
  }
});

test("percentage rollout without a tenant id cannot be sampled (off)", () => {
  assert.equal(
    isFlagEnabledForTenant(flag({ valueJson: '{"rolloutPercent": 100}' }), undefined),
    false,
  );
});

test("a plain enabled flag with no rollout and no override is global-on", () => {
  assert.equal(isFlagEnabledForTenant(flag({}), "tenantA"), true);
  assert.equal(isFlagEnabledForTenant(flag({}), undefined), true);
  assert.equal(isFlagEnabledForTenant(flag({}), null), true);
});

test("rolloutPercentOf tolerates malformed or missing payloads", () => {
  assert.equal(rolloutPercentOf(undefined), undefined);
  assert.equal(rolloutPercentOf(""), undefined);
  assert.equal(rolloutPercentOf("not json"), undefined);
  assert.equal(rolloutPercentOf("null"), undefined);
  assert.equal(rolloutPercentOf('{"rolloutPercent": 25}'), 25);
  assert.equal(rolloutPercentOf('{"rolloutPercent": 100}'), 100);
  assert.equal(rolloutPercentOf('{"rolloutPercent": 0}'), 0);
  assert.equal(rolloutPercentOf('{"rolloutPercent": 25.5}'), undefined);
  assert.equal(rolloutPercentOf('{"rolloutPercent": -1}'), undefined);
  assert.equal(rolloutPercentOf('{"rolloutPercent": 101}'), undefined);
});

test("rolloutPercentOf picks the field out of a larger payload", () => {
  assert.equal(
    rolloutPercentOf('{"rolloutPercent": 40, "limit": 10}'),
    40,
  );
});

test("parseFlagValue returns the object payload and {} for junk", () => {
  assert.deepEqual(parseFlagValue('{"a": 1}'), { a: 1 });
  assert.deepEqual(parseFlagValue(""), {});
  assert.deepEqual(parseFlagValue(undefined), {});
  assert.deepEqual(parseFlagValue('"plain"'), {});
});

test("rollout covers a sane fraction of tenants for a mid rollout", () => {
  const f = flag({ valueJson: '{"rolloutPercent": 30}' });
  const on = Array.from({ length: 10_000 }, (_, i) => i).filter((i) =>
    isFlagEnabledForTenant(f, `tenant${i}`),
  ).length;
  // ±4% tolerance around the configured 30% to avoid flaky failures.
  assert.ok(on >= 2600 && on <= 3400, `expected ~3000, got ${on}`);
});