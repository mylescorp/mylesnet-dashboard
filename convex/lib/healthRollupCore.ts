/**
 * Pure rollup logic for the platform telemetry & health overview (spec B5).
 *
 * Health is derived from the existing operations estate — the B1 device fleet
 * registry (lastSeenAt / uptimePercent / lifecycleStatus), the alerts table,
 * and the latest router + access-point health samples — never from a second
 * copy of data. Everything here is deterministic and free of Convex I/O so it
 * can be unit-tested in isolation.
 *
 * The staleness thresholds are deliberately surface-level today: they classify
 * a device by how recently it reported versus how long its fleet row has been
 * silent. This is real telemetry rollup over existing writes, not fabricated
 * state.
 */

export type HealthTone = "ok" | "warning" | "critical" | "unknown";

export const HEALTH_TONES: readonly HealthTone[] = [
  "ok",
  "warning",
  "critical",
  "unknown",
];

export function isHealthToneValue(value: string): value is HealthTone {
  return HEALTH_TONES.includes(value as HealthTone);
}

/** Drop a version label into a stable firmware family slug. */
export function classifyFirmwareFamily(firmwareVersion: string | null): string {
  if (!firmwareVersion) return "unknown";
  return firmwareVersion.trim().toLowerCase() || "unknown";
}

/**
 * Define the rolling window used to classify devices. Both values must be
 * finite positive millisecond counts; null/undefined windows mean the rollup
 * falls back to sane defaults.
 */
export function isStalenessWindowValid(windowMs: number | null | undefined): boolean {
  if (windowMs == null) return true;
  return Number.isFinite(windowMs) && windowMs > 0;
}

/**
 * How long a health sample stays "current" before the rollup treats the
 * router/AP data as stale. Finite positive millis, or null for the default.
 */
export function isSampleFreshnessValid(freshnessMs: number | null | undefined): boolean {
  if (freshnessMs == null) return true;
  return Number.isFinite(freshnessMs) && freshnessMs > 0;
}

export type DeviceHealthInput = {
  lifecycleStatus: string;
  status: string;
  uptimePercent: number | null | undefined;
  lastSeenAt: number | null | undefined;
  now: number;
  /** Device older than this many ms is "critical" (deemed offline). */
  offlineAfterMs: number;
  /** Device older than this many ms is "warning" (silent). */
  warningAfterMs: number;
};

/**
 * Classify one fleet device's tone.
 *
 * - Deleted rows are "unknown" (they should never surface in a health rollup).
 * - Maintenance rows are "ok" — planned activity suppresses alerts and outages
 *   by design (spec §17), so they must not read as incidents.
 * - A device with no lastSeenAt is "unknown".
 * - Last seen longer ago than `offlineAfterMs` → "critical".
 * - Last seen longer ago than `warningAfterMs` → "warning".
 * - Otherwise "ok" — uptime is advisory, not a gating tone.
 */
export function computeDeviceHealthTone(input: DeviceHealthInput): HealthTone {
  if (
    input.status === "deleted" ||
    input.lifecycleStatus === "deleted"
  ) {
    return "unknown";
  }
  if (input.lifecycleStatus === "maintenance") {
    return "ok";
  }
  if (input.lastSeenAt == null) {
    return "unknown";
  }
  const age = input.now - input.lastSeenAt;
  if (age > input.offlineAfterMs) return "critical";
  if (age > input.warningAfterMs) return "warning";
  return "ok";
}

/**
 * Combine a set of tones into the single worst state. Tones rank
 * critical > warning > unknown > ok, so a rollup that includes one critical
 * device must read critical even if everything else is healthy.
 */
export function combineHealthTones(tones: readonly HealthTone[]): HealthTone {
  let worst: HealthTone = "ok";
  for (const tone of tones) {
    if (tone === "critical") return "critical";
    if (tone === "warning") {
      worst = "warning";
    } else if (tone === "unknown" && worst === "ok") {
      worst = "unknown";
    }
  }
  return worst;
}

export type ToneCounts = Record<HealthTone, number>;

/** Count per-tone totals from a list of already-classified rows. */
export function countTones(tones: readonly HealthTone[]): ToneCounts {
  const counts: ToneCounts = { ok: 0, warning: 0, critical: 0, unknown: 0 };
  for (const tone of tones) counts[tone] += 1;
  return counts;
}

/** Mean uptime across devices that report it (null if none do). */
export function averageUptimePercent(
  values: readonly (number | null | undefined)[],
): number | null {
  const known = values.filter(
    (v): v is number => typeof v === "number" && Number.isFinite(v),
  );
  if (known.length === 0) return null;
  const total = known.reduce((sum, v) => sum + v, 0);
  return Math.round((total / known.length) * 100) / 100;
}

export type HealthRollupRow = {
  generatedAt: number;
  offlineAfterMs: number;
  warningAfterMs: number;
  devices: {
    total: number;
    byTone: ToneCounts;
    averageUptimePercent: number | null;
    firmwareFamilies: string[];
  };
  routers: {
    total: number;
    withRecentSample: number;
  };
  openAlerts: {
    total: number;
    critical: number;
    warning: number;
    info: number;
  };
  bestDeviceTone: HealthTone;
  overallTone: HealthTone;
};

export type HealthRollupInput = {
  now: number;
  offlineAfterMs: number;
  warningAfterMs: number;
  deviceTones: readonly HealthTone[];
  uptimeValues: readonly (number | null | undefined)[];
  firmwareValues: readonly (string | null | undefined)[];
  routerTotal: number;
  routerRecentSamples: number;
  openAlerts: {
    severity: "info" | "warning" | "critical";
  }[];
};

/**
 * Build the canonical platform health rollup row from pre-aggregated inputs.
 * Keeps the pure core free of database shapes: the caller feeds only what the
 * overview needs, and the row is flat + serializable.
 */
export function buildHealthRollupRow(input: HealthRollupInput): HealthRollupRow {
  const byTone = countTones(input.deviceTones);
  const alertCounts = { critical: 0, warning: 0, info: 0 };
  for (const alert of input.openAlerts) alertCounts[alert.severity] += 1;

  return {
    generatedAt: input.now,
    offlineAfterMs: input.offlineAfterMs,
    warningAfterMs: input.warningAfterMs,
    devices: {
      total: input.deviceTones.length,
      byTone,
      averageUptimePercent: averageUptimePercent(input.uptimeValues),
      firmwareFamilies: Array.from(
        new Set(input.firmwareValues.map((f) => classifyFirmwareFamily(f ?? null))),
      ).sort(),
    },
    routers: {
      total: input.routerTotal,
      withRecentSample: input.routerRecentSamples,
    },
    openAlerts: {
      total:
        alertCounts.critical + alertCounts.warning + alertCounts.info,
      ...alertCounts,
    },
    bestDeviceTone: combineHealthTones(input.deviceTones),
    overallTone: combineHealthTones([
      combineHealthTones(input.deviceTones),
      alertCounts.critical > 0
        ? "critical"
        : alertCounts.warning > 0
          ? "warning"
          : "ok",
    ]),
  };
}