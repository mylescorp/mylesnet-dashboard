/**
 * Pure policy-template logic for the platform (spec B4).
 *
 * A policy template is a versioned PPPoE / rate-limit profile. Each family
 * (identified by a stable `code`) is versioned 1..n; versions are immutable
 * once published, so tenants already provisioned against an old version keep
 * their behavior when a newer version ships. Everything here is deterministic
 * and free of Convex I/O so it can be unit-tested in isolation.
 */

export type PolicyTemplateKind = "pppoe" | "rate_limit";

export type PolicyTemplateStatus = "draft" | "published" | "retired";

export const POLICY_TEMPLATE_KINDS: readonly PolicyTemplateKind[] = [
  "pppoe",
  "rate_limit",
];

export const POLICY_TEMPLATE_STATUSES: readonly PolicyTemplateStatus[] = [
  "draft",
  "published",
  "retired",
];

export function isPolicyTemplateKind(value: string): value is PolicyTemplateKind {
  return (POLICY_TEMPLATE_KINDS as readonly string[]).includes(value);
}

export function isPolicyTemplateStatus(
  value: string,
): value is PolicyTemplateStatus {
  return (POLICY_TEMPLATE_STATUSES as readonly string[]).includes(value);
}

/**
 * A published (or retired) version is frozen: its rate-limit fields may never
 * change, because subscribers were provisioned against it. Only drafts are
 * editable. This is the core guarantee that versioning never silently changes
 * behavior for tenants on an older version.
 */
export function isPolicyVersionFrozen(
  status: PolicyTemplateStatus,
): boolean {
  return status !== "draft";
}

/**
 * Family code: stable, non-empty slug up to 80 chars. Different families are
 * independent version series.
 */
export function isValidPolicyTemplateCode(code: string): boolean {
  if (code.length < 2 || code.length > 80) return false;
  return /^[a-z0-9][a-z0-9\-]*$/.test(code);
}

/** Human display name (3–80 chars). */
export function isValidPolicyTemplateName(name: string): boolean {
  const trimmed = name.trim();
  return trimmed.length >= 3 && trimmed.length <= 80;
}

/**
 * A rate value in Mbps must be a finite positive number below a sane ceiling
 * (1 Tbps plan cap).
 */
export function isValidRateMbps(value: number): boolean {
  return Number.isFinite(value) && value > 0 && value <= 1_000_000;
}

/**
 * Burst values are optional; when present they must be finite and
 * non-negative.
 */
export function isValidBurstMbps(value: number | undefined): boolean {
  if (value === undefined) return true;
  return Number.isFinite(value) && value >= 0 && value <= 1_000_000;
}

/**
 * Compute the next version number for a family given the highest existing
 * version. Families start at 1; a fresh family (currentMax null) yields 1.
 */
export function nextPolicyTemplateVersion(
  currentMaxVersion: number | null,
): number {
  return currentMaxVersion === null ? 1 : currentMaxVersion + 1;
}

export type PolicyTemplateRow = {
  _id: string;
  code: string;
  name: string;
  version: number;
  kind: PolicyTemplateKind;
  downloadMbps: number;
  uploadMbps: number;
  burstDownloadMbps: number | null;
  burstUploadMbps: number | null;
  burstThresholdMbps: number | null;
  burstTimeSeconds: number | null;
  status: PolicyTemplateStatus;
  description: string | null;
  createdBy: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

export type PolicyTemplateMergeInput = {
  _id: string;
  code: string;
  name: string;
  version: number;
  kind: PolicyTemplateKind;
  downloadMbps: number;
  uploadMbps: number;
  burstDownloadMbps?: number | null;
  burstUploadMbps?: number | null;
  burstThresholdMbps?: number | null;
  burstTimeSeconds?: number | null;
  status: PolicyTemplateStatus;
  description?: string | null;
  createdBy?: string | null;
  createdAt?: number | null;
  updatedAt?: number | null;
};

/** Merge enriched lookups into a flat, serializable PolicyTemplateRow. */
export function buildPolicyTemplateRow(
  template: PolicyTemplateMergeInput,
): PolicyTemplateRow {
  return {
    _id: template._id,
    code: template.code,
    name: template.name,
    version: template.version,
    kind: template.kind,
    downloadMbps: template.downloadMbps,
    uploadMbps: template.uploadMbps,
    burstDownloadMbps: template.burstDownloadMbps ?? null,
    burstUploadMbps: template.burstUploadMbps ?? null,
    burstThresholdMbps: template.burstThresholdMbps ?? null,
    burstTimeSeconds: template.burstTimeSeconds ?? null,
    status: template.status,
    description: template.description ?? null,
    createdBy: template.createdBy ?? null,
    createdAt: template.createdAt ?? null,
    updatedAt: template.updatedAt ?? null,
  };
}

export type PolicyTemplateVersionInfo = {
  code: string;
  latestVersion: number;
  latestId: string;
};

/**
 * Reduce a set of template rows to the latest version id per family code,
 * preserving older versions (which remain active for their tenants).
 */
export function latestVersionPerFamily(
  templates: ReadonlyArray<{
    _id: string;
    code: string;
    version: number;
  }>,
): Map<string, PolicyTemplateVersionInfo> {
  const latest = new Map<string, PolicyTemplateVersionInfo>();
  for (const template of templates) {
    const current = latest.get(template.code);
    if (!current || template.version > current.latestVersion) {
      latest.set(template.code, {
        code: template.code,
        latestVersion: template.version,
        latestId: template._id,
      });
    }
  }
  return latest;
}