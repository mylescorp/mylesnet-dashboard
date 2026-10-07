import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type DataRequestType = "export" | "deletion";
export type DataRequestStatus = "received" | "under_review" | "completed" | "rejected";
export type PlatformDataRequest = {
  _id: string; tenantId?: string; tenantName: string | null; requestType: DataRequestType;
  requesterName: string; requesterEmail: string; requestNotes: string; status: DataRequestStatus;
  adminNotes?: string; createdAt: number; updatedAt: number; deletedAt?: number; deleteReason?: string;
};
type PageArgs = { paginationOpts: { numItems: number; cursor: string | null }; includeDeleted?: boolean };

export const platformDataRequests = {
  list: makeFunctionReference<"query", PageArgs, PaginationResult<PlatformDataRequest>>("platformDataRequests:list"),
  create: makeFunctionReference<"mutation", { tenantId?: string; requestType: DataRequestType; requesterName: string; requesterEmail: string; requestNotes: string }, string>("platformDataRequests:create"),
  update: makeFunctionReference<"mutation", { requestId: string; tenantId?: string; requestType?: DataRequestType; requesterName?: string; requesterEmail?: string; requestNotes?: string; status?: DataRequestStatus; adminNotes?: string }, { updated: boolean }>("platformDataRequests:update"),
  remove: makeFunctionReference<"mutation", { requestId: string; reason: string }, { archived: boolean }>("platformDataRequests:remove"),
  restore: makeFunctionReference<"mutation", { requestId: string }, { restored: boolean }>("platformDataRequests:restore"),
};
