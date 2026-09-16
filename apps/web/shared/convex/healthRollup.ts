import { makeFunctionReference } from "convex/server";

export type HealthTone = "ok" | "warning" | "critical" | "unknown";

export type ToneCounts = Record<HealthTone, number>;

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

export type LatestRouterSample = {
  timestamp: number;
  cpuPercent: number;
  memoryPercent: number;
  linkState: boolean;
  connectedUserCount: number | null;
  txBytesPerSec: number;
  rxBytesPerSec: number;
};

export type PlatformHealthOverview = {
  overview: HealthRollupRow;
  deviceRows: {
    _id: string;
    name: string;
    deviceKind: string;
    marketId: string;
    marketName: string | null;
    tenantId: string | null;
    tenantName: string | null;
    tone: HealthTone;
    lifecycleStatus: string;
    lastSeenAt: number | null;
    uptimePercent: number | null;
    firmwareVersion: string | null;
    routerId: string | null;
    routerName: string | null;
  }[];
  routerRows: {
    _id: string;
    name: string;
    marketId: string | null;
    marketName: string | null;
    tone: HealthTone;
    latest: LatestRouterSample | null;
    managedSwitches: number;
  }[];
  openAlerts: {
    _id: string;
    severity: "info" | "warning" | "critical" | null;
    message: string;
    openedAt: number;
    marketId: string | null;
  }[];
};

export type RouterHealthDetail = {
  _id: string;
  name: string;
  marketId: string | null;
  samples: LatestRouterSample[];
  accessPointHealth: {
    accessPointId: string;
    name: string;
    latest: {
      timestamp: number;
      linkState: boolean;
      connectedUserCount: number | null;
      ccq: number | null;
      signalStrengthDbm: number | null;
    } | null;
  }[];
} | null;

export const healthRollup = {
  overview: makeFunctionReference<
    "query",
    Record<string, never>,
    PlatformHealthOverview
  >("healthRollup:getPlatformHealthOverview"),
  routerDetail: makeFunctionReference<
    "query",
    { routerId: string },
    RouterHealthDetail
  >("healthRollup:getPlatformRouterHealthDetail"),
};