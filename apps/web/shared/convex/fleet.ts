import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

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
  deletedAt: number | null;
};

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const fleet = {
  list: makeFunctionReference<
    "query",
    { paginationOpts: { numItems: number; cursor: string | null }; provisioningStatus?: DeviceProvisioningStatus; includeArchived?: boolean },
    PaginationResult<FleetRow>
  >("fleet:listDeviceFleet"),
  get: makeFunctionReference<
    "query",
    { deviceId: string },
    FleetRow | null
  >("fleet:getDeviceFleetRow"),
  update: makeFunctionReference<
    "mutation",
    {
      deviceId: string;
      name?: string;
      deviceKind?: string;
      firmwareVersion?: string | null;
      provisioningStatus?: DeviceProvisioningStatus;
    },
    void
  >("fleet:updateDeviceFleetRow"),
  listMarkets: makeFunctionReference<
    "query",
    { paginationOpts: { numItems: number; cursor: string | null } },
    PaginationResult<{ _id: string; name: string; tenantId: string | null }>
  >("fleet:listMarketsForFleetManagement"),
  register: makeFunctionReference<"mutation", { marketId: string; name: string; deviceKind: string; macAddress?: string; firmwareVersion?: string }, string>("fleet:registerDevice"),
  archive: makeFunctionReference<"mutation", { deviceId: string; reason: string }, void>("fleet:archiveDevice"),
  restore: makeFunctionReference<"mutation", { deviceId: string }, void>("fleet:restoreDevice"),
};
