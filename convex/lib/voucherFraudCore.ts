/**
 * Pure anomaly-detection logic for the voucher redemption monitor (spec F1).
 *
 * Works on a flat list of redemption records (redeemed vouchers), NOT on
 * counters — velocity is derived at query time from the records themselves,
 * there is deliberately no counter column.
 *
 * Signals computed per redemption:
 *   - duplicate-code : the same voucher code appears more than once in the set.
 *   - velocity       : the same device/IP/phone redeemed several codes within
 *                      the velocity window (default 15 min, configurable).
 *   - geo-anomaly    : the same phone or device redeemed from multiple distinct
 *                      IP addresses (unexpected roaming between locations).
 *
 * A redemption is `blocked` if it combines velocity AND geo (or a duplicate
 * code); `flagged` for a single signal; `clean` otherwise.
 */

export type RedemptionRecord = {
  voucherId: string;
  code: string;
  marketId: string;
  redeemedAt: number;
  customerPhone?: string | null;
  redeemedDeviceId?: string | null;
  redeemedIpAddress?: string | null;
};

export type RedemptionSignal = "duplicate_code" | "velocity" | "geo_anomaly";

export type AnomalyVerdict = "blocked" | "flagged" | "clean";

export type RedemptionAssessment = {
  voucherId: string;
  code: string;
  signals: RedemptionSignal[];
  verdict: AnomalyVerdict;
  redeemCount: number;
  distinctIps: number;
  sameDeviceVelocity: number;
  sameIpVelocity: number;
  samePhoneVelocity: number;
};

export type VelocityConfig = {
  windowMs?: number;
  velocityThreshold?: number;
};

const DEFAULT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_VELOCITY_THRESHOLD = 3;

function distinctStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v)))];
}

/**
 * Assign each redemption a verdict based purely on the surrounding records.
 * The emitted order matches the records' input order (stable join by id).
 */
export function assessRedemptions(
  records: RedemptionRecord[],
  config: VelocityConfig = {},
): RedemptionAssessment[] {
  const windowMs = config.windowMs ?? DEFAULT_WINDOW_MS;
  const velocityThreshold = config.velocityThreshold ?? DEFAULT_VELOCITY_THRESHOLD;

  const codeCounts = new Map<string, number>();
  for (const r of records) {
    codeCounts.set(r.code, (codeCounts.get(r.code) ?? 0) + 1);
  }

  const byDevice = groupKeyed(records, (r) => r.redeemedDeviceId);
  const byIp = groupKeyed(records, (r) => r.redeemedIpAddress);
  const byPhone = groupKeyed(records, (r) => r.customerPhone);

  const sameDeviceVelocityOf = (id: string) => windowedCount(byDevice.get(id) ?? [], windowMs);
  const sameIpVelocityOf = (id: string) => windowedCount(byIp.get(id) ?? [], windowMs);
  const samePhoneVelocityOf = (id: string) => windowedCount(byPhone.get(id) ?? [], windowMs);

  return records.map((r) => {
    const signals: RedemptionSignal[] = [];

    if ((codeCounts.get(r.code) ?? 1) > 1) signals.push("duplicate_code");

    const deviceVelocity =
      r.redeemedDeviceId != null ? sameDeviceVelocityOf(r.redeemedDeviceId) : 0;
    const ipVelocity = r.redeemedIpAddress != null ? sameIpVelocityOf(r.redeemedIpAddress) : 0;
    const phoneVelocity = r.customerPhone != null ? samePhoneVelocityOf(r.customerPhone) : 0;
    const peakVelocity = Math.max(deviceVelocity, ipVelocity, phoneVelocity);
    if (peakVelocity >= velocityThreshold) {
      signals.push("velocity");
    }

    const pairedIpsByPhone = groupKeyed(records, (rec) => rec.customerPhone);
    const pairedIpsByDevice = groupKeyed(records, (rec) => rec.redeemedDeviceId);
    const ipsForPhone = r.customerPhone ? distinctStrings(pairedIpsByPhone.get(r.customerPhone)?.map((x) => x.redeemedIpAddress) ?? []) : [];
    const ipsForDevice = r.redeemedDeviceId ? distinctStrings(pairedIpsByDevice.get(r.redeemedDeviceId)?.map((x) => x.redeemedIpAddress) ?? []) : [];
    const distinctIps = distinctStrings([...ipsForPhone, ...ipsForDevice]);
    if (distinctIps.length > 1) signals.push("geo_anomaly");

    const verdict: AnomalyVerdict =
      signals.includes("duplicate_code") ||
      (signals.includes("velocity") && signals.includes("geo_anomaly"))
        ? "blocked"
        : signals.length > 0
          ? "flagged"
          : "clean";

    return {
      voucherId: r.voucherId,
      code: r.code,
      signals,
      verdict,
      redeemCount: codeCounts.get(r.code) ?? 1,
      distinctIps: distinctIps.length,
      sameDeviceVelocity: deviceVelocity,
      sameIpVelocity: ipVelocity,
      samePhoneVelocity: phoneVelocity,
    };
  });
}

type Keyed = Map<string, RedemptionRecord[]>;

function groupKeyed(
  records: RedemptionRecord[],
  keyOf: (r: RedemptionRecord) => string | null | undefined,
): Keyed {
  const map: Keyed = new Map();
  for (const r of records) {
    const key = keyOf(r);
    if (key == null) continue;
    const list = map.get(key);
    if (list) list.push(r);
    else map.set(key, [r]);
  }
  return map;
}

function windowedCount(records: RedemptionRecord[], windowMs: number): number {
  if (records.length <= 1) return records.length;
  const sorted = [...records].sort((a, b) => a.redeemedAt - b.redeemedAt);
  let best = 1;
  let i = 0;
  for (let j = 0; j < sorted.length; j++) {
    while (sorted[j].redeemedAt - sorted[i].redeemedAt > windowMs) i++;
    best = Math.max(best, j - i + 1);
  }
  return best;
}

export function isFraudFlagStatus(value: string): value is "clean" | "flagged" | "blocked" {
  return value === "clean" || value === "flagged" || value === "blocked";
}