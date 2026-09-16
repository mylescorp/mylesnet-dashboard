import { makeFunctionReference } from "convex/server";

export type FirmwareRolloutStatus =
  | "draft"
  | "running"
  | "paused"
  | "completed"
  | "cancelled";

export type FirmwareRolloutScope =
  | { type: "market"; marketId: string }
  | { type: "device_kind"; deviceKind: string }
  | { type: "single"; deviceId: string };

export type FirmwareRolloutRow = {
  _id: string;
  label: string;
  scope: FirmwareRolloutScope;
  waveSize: number;
  status: FirmwareRolloutStatus;
  appliedCount: number;
  targetCount: number;
  progress: number;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
};

export type FirmwareRolloutDetail = {
  _id: string;
  label: string;
  scope: FirmwareRolloutScope;
  waveSize: number;
  status: FirmwareRolloutStatus;
  appliedCount: number;
  targetCount: number;
  progress: number;
  createdBy: string | null;
  createdAt: number;
  updatedAt: number;
  startedAt: number | null;
  completedAt: number | null;
  cancelledAt: number | null;
  devices: {
    _id: string;
    name: string;
    marketId: string;
    deviceKind: string;
    firmwareVersion: string | null;
    applied: boolean;
  }[];
};

export const firmwareRollout = {
  list: makeFunctionReference<
    "query",
    { status?: string },
    FirmwareRolloutRow[]
  >("firmwareRollout:listFirmwareRollouts"),
  get: makeFunctionReference<
    "query",
    { rolloutId: string },
    FirmwareRolloutDetail | null
  >("firmwareRollout:getFirmwareRollout"),
  create: makeFunctionReference<
    "mutation",
    {
      label: string;
      marketId?: string;
      deviceKind?: string;
      deviceId?: string;
      waveSize: number;
    },
    string
  >("firmwareRollout:createFirmwareRollout"),
  start: makeFunctionReference<
    "mutation",
    { rolloutId: string },
    void
  >("firmwareRollout:startFirmwareRollout"),
  advance: makeFunctionReference<
    "mutation",
    { rolloutId: string },
    void
  >("firmwareRollout:advanceFirmwareRolloutWave"),
  pause: makeFunctionReference<
    "mutation",
    { rolloutId: string },
    void
  >("firmwareRollout:pauseFirmwareRollout"),
  resume: makeFunctionReference<
    "mutation",
    { rolloutId: string },
    void
  >("firmwareRollout:resumeFirmwareRollout"),
  complete: makeFunctionReference<
    "mutation",
    { rolloutId: string },
    void
  >("firmwareRollout:completeFirmwareRollout"),
  cancel: makeFunctionReference<
    "mutation",
    { rolloutId: string },
    void
  >("firmwareRollout:cancelFirmwareRollout"),
};