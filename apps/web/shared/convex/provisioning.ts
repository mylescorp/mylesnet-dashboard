import { makeFunctionReference } from "convex/server";

export type ProvisioningStatus = "pending" | "approved" | "rejected" | "deployed";

export type ProvisioningRequest = {
  _id: string;
  tenantId: string | null;
  marketId: string;
  deviceId: string | null;
  requestedFirmware: string | null;
  requesterId: string;
  requesterName: string | null;
  requestedAt: number;
  status: ProvisioningStatus;
  decidedBy: string | null;
  decidedByName: string | null;
  decidedAt: number | null;
  decisionNote: string | null;
  createdAt: number;
};

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const provisioning = {
  listRequests: makeFunctionReference<
    "query",
    { status?: ProvisioningStatus; marketId?: string },
    ProvisioningRequest[]
  >("provisioning:listProvisioningRequests"),
  getRequest: makeFunctionReference<
    "query",
    { requestId: string },
    ProvisioningRequest | null
  >("provisioning:getProvisioningRequest"),
  requestDeviceProvisioning: makeFunctionReference<
    "mutation",
    {
      marketId: string;
      deviceId?: string;
      requestedFirmware?: string;
    },
    string
  >("provisioning:requestDeviceProvisioning"),
  decide: makeFunctionReference<
    "mutation",
    { requestId: string; decision: "approved" | "rejected"; note?: string },
    void
  >("provisioning:decideProvisioningRequest"),
  markDeployed: makeFunctionReference<
    "mutation",
    { requestId: string },
    void
  >("provisioning:markProvisioningDeployed"),
};