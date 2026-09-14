import { makeFunctionReference } from "convex/server";

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

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const fleet = {
  list: makeFunctionReference<
    "query",
    { marketId?: string; provisioningStatus?: string },
    FleetRow[]
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
      firmwareVersion?: string;
      uptimePercent?: number;
      provisioningStatus?: DeviceProvisioningStatus;
    },
    void
  >("fleet:updateDeviceFleetRow"),
};