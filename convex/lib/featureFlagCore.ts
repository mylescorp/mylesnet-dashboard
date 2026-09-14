/**
 * Pure evaluation logic for the platform feature-flag store (spec K).
 *
 * A flag row carries: `enabled` (master switch), optional `tenantIds`
 * (per-tenant override allow-list), and `valueJson` — the flag payload, which
 * MAY contain an integer `rolloutPercent` (0-100) for percentage rollouts.
 *
 * Evaluation order:
 *   1. `enabled === false` → off for everyone.
 *   2. `tenantIds` present → on only for tenants in the list (the override).
 *   3. `valueJson.rolloutPercent` present (0-100) → deterministic hash-sample
 *      of (key, tenantId). A missing tenantId cannot be sampled → off.
 *   4. otherwise → on for all.
 */

export type FlagLike = {
  key: string;
  enabled: boolean;
  tenantIds?: string[] | null;
  valueJson?: string;
};

export function parseFlagValue(valueJson: string | undefined | null): Record<string, unknown> {
  if (!valueJson) return {};
  try {
    const parsed: unknown = JSON.parse(valueJson);
    return typeof parsed === "object" && parsed !== null ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

export function rolloutPercentOf(valueJson: string | undefined | null): number | undefined {
  const parsed = parseFlagValue(valueJson);
  const value = parsed.rolloutPercent;
  if (typeof value !== "number") return undefined;
  if (!Number.isInteger(value) || value < 0 || value > 100) return undefined;
  return value;
}

/** Deterministic, tenant-stable hash of (key, tenantId) → 0..99. */
export function hashBucket(key: string, tenantId: string): number {
  let hash = 2166136261;
  const seed = `${key}:${tenantId}`;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % 100;
}

export function isFlagEnabledForTenant(flag: FlagLike, tenantId: string | null | undefined): boolean {
  if (!flag.enabled) return false;
  if (flag.tenantIds && flag.tenantIds.length > 0) {
    return tenantId !== undefined && tenantId !== null && flag.tenantIds.includes(tenantId);
  }
  const percent = rolloutPercentOf(flag.valueJson);
  if (percent !== undefined) {
    if (tenantId === undefined || tenantId === null) return false;
    return hashBucket(flag.key, tenantId) < percent;
  }
  return true;
}