import { makeFunctionReference } from "convex/server";

export type RadiusServerStatus =
  | "active"
  | "provisioning"
  | "failed"
  | "maintenance"
  | "decommissioned";

export type RadiusServerProtocol = "radsec" | "udp";

export type RadiusHealthStatus = "healthy" | "degraded" | "down" | "unknown";

export type RadiusServerRow = {
  _id: string;
  name: string;
  hostname: string;
  port: number;
  protocol: RadiusServerProtocol;
  status: RadiusServerStatus;
  healthStatus: RadiusHealthStatus;
  region: string | null;
  certExpiryAt: number | null;
  lastHealthCheckAt: number | null;
  notes: string | null;
  registeredBy: string | null;
  createdAt: number | null;
};

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const radiusFleet = {
  list: makeFunctionReference<
    "query",
    { status?: string; protocol?: string },
    RadiusServerRow[]
  >("radiusFleet:listRadiusServers"),
  get: makeFunctionReference<
    "query",
    { serverId: string },
    RadiusServerRow | null
  >("radiusFleet:getRadiusServerRow"),
  create: makeFunctionReference<
    "mutation",
    {
      name: string;
      hostname: string;
      port: number;
      protocol: RadiusServerProtocol;
      region?: string;
      notes?: string;
    },
    string
  >("radiusFleet:createRadiusServer"),
  update: makeFunctionReference<
    "mutation",
    {
      serverId: string;
      name?: string;
      hostname?: string;
      port?: number;
      protocol?: RadiusServerProtocol;
      status?: RadiusServerStatus;
      healthStatus?: RadiusHealthStatus;
      region?: string;
      notes?: string;
    },
    void
  >("radiusFleet:updateRadiusServer"),
  delete: makeFunctionReference<
    "mutation",
    { serverId: string; deleteReason: string },
    void
  >("radiusFleet:deleteRadiusServer"),
};
