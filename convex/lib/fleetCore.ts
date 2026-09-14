/**
 * Pure fleet-view logic for the platform device registry (spec B1).
 *
 * A fleet row joins the raw device record with its market and the tenant the
 * device belongs to (device.tenantId, else the market's tenant). Everything
 * here is deterministic and free of Convex I/O so it can be unit-tested in
 * isolation — including the multi-tenant resolution rule, which must never
 * fall back to a tenant other than the device's own.
 */

export type DeviceProvisioningStatus =
  | "unprovisioned"
  | "pending"
  | "provisioned"
  | "failed";

export type FleetRow = {
  _id: string;
  tenantId: string | null;
  tenantName: string | null;
  marketId: string;
  marketName: string | null;
  name: string;
  deviceKind: string;
  firmwareVersion: string | null;
  lastSeenAt: number | null;
  uptimePercent: number | null;
  provisioningStatus: DeviceProvisioningStatus | null;
  lifecycleStatus: string;
  registeredBy: string | null;
  registeredAt: number | null;
};

export type FleetMergeInput = {
  _id: string;
  tenantId?: string | null;
  marketId: string;
  marketName?: string | null;
  name: string;
  deviceKind: string;
  firmwareVersion?: string | null;
  lastSeenAt?: number | null;
  uptimePercent?: number | null;
  provisioningStatus?: DeviceProvisioningStatus | null;
  lifecycleStatus: string;
  registeredBy?: string | null;
  createdAt?: number | null;
};

/**
 * Merge enriched lookups into a device row into a flat, serializable FleetRow.
 *
 * Multi-tenant rule: the tenant is resolved from the device's OWN tenantId
 * first; only when the device has none do we inherit the market's tenant id.
 * The tenant *name* is looked up exclusively through that resolved id — a
 * device can never be labelled with another tenant's name.
 */
export function buildFleetRow(
  device: FleetMergeInput,
  tenantId: string | null,
  tenantName: string | null,
): FleetRow {
  return {
    _id: device._id,
    tenantId,
    tenantName,
    marketId: device.marketId,
    marketName: device.marketName ?? null,
    name: device.name,
    deviceKind: device.deviceKind,
    firmwareVersion: device.firmwareVersion ?? null,
    lastSeenAt: device.lastSeenAt ?? null,
    uptimePercent: device.uptimePercent ?? null,
    provisioningStatus: device.provisioningStatus ?? null,
    lifecycleStatus: device.lifecycleStatus,
    registeredBy: device.registeredBy ?? null,
    registeredAt: device.createdAt ?? null,
  };
}

export function isUptimePercentValid(value: number | undefined): boolean {
  if (value === undefined) return true;
  return Number.isFinite(value) && value >= 0 && value <= 100;
}

export function isProvisioningStatusValue(
  value: string,
): value is DeviceProvisioningStatus {
  return (
    value === "unprovisioned" ||
    value === "pending" ||
    value === "provisioned" ||
    value === "failed"
  );
}