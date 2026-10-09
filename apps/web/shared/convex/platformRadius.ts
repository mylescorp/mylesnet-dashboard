import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type PlatformRadiusRow = {
  _id: string; name: string; hostname: string; region: string; authPort: number; accountingPort: number;
  transport: "udp" | "tcp" | "tls"; softwareVersion: string | null;
  lifecycleStatus: "planned" | "active" | "degraded" | "maintenance" | "retired";
  capacitySessions: number | null; uptimePercent: number | null; latencyMs: number | null; activeSessions: number | null;
  authSuccessPercent: number | null; authFailurePercent: number | null; metricsObservedAt: number | null;
  createdAt: number; updatedAt: number; archivedAt: number | null; archiveReason: string | null;
};
type PageArgs = { paginationOpts: { numItems: number; cursor: string | null }; includeArchived?: boolean };
type WriteArgs = { name: string; hostname: string; region: string; authPort: number; accountingPort: number; transport: "udp" | "tcp" | "tls"; softwareVersion?: string; lifecycleStatus: PlatformRadiusRow["lifecycleStatus"]; capacitySessions?: number };
type UpdateArgs = { serverId: string; name?: string; hostname?: string; region?: string; authPort?: number; accountingPort?: number; transport?: PlatformRadiusRow["transport"]; softwareVersion?: string | null; lifecycleStatus?: PlatformRadiusRow["lifecycleStatus"]; capacitySessions?: number | null };

export const platformRadius = {
  list: makeFunctionReference<"query", PageArgs, PaginationResult<PlatformRadiusRow>>("platformRadius:list"),
  create: makeFunctionReference<"mutation", WriteArgs, string>("platformRadius:create"),
  update: makeFunctionReference<"mutation", UpdateArgs, { updated: boolean }>("platformRadius:update"),
  archive: makeFunctionReference<"mutation", { serverId: string; reason: string }, { archived: boolean }>("platformRadius:archive"),
  restore: makeFunctionReference<"mutation", { serverId: string }, { restored: boolean }>("platformRadius:restore"),
};
