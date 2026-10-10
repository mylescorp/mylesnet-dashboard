import { makeFunctionReference } from "convex/server";

export type PlatformTicketCategory = "network" | "billing" | "account";
export type PlatformTicketStatus = "open" | "in_progress" | "waiting_on_customer" | "resolved" | "closed";
export type PlatformTicket = {
  _id: string; subject: string; description: string; category?: PlatformTicketCategory;
  priority: "low" | "medium" | "high" | "urgent"; ticketStatus: PlatformTicketStatus;
  tenantId?: string; tenantName?: string | null; marketId?: string; createdAt: number;
  firstResponseDueAt?: number; resolutionDueAt?: number; deletedAt?: number;
};
export type PlatformTicketDetail = {
  subject: string; description: string; category: PlatformTicketCategory;
  priority: PlatformTicket["priority"]; ticketStatus: PlatformTicketStatus;
  tenantName: string | null; marketName: string | null; createdAt: number;
  firstResponseDueAt: number | null; resolutionDueAt: number | null;
};

export const platformSupport = {
  list: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null }; category?: PlatformTicketCategory; ticketStatus?: PlatformTicketStatus; includeDeleted?: boolean }, import("convex/server").PaginationResult<PlatformTicket>> ("supportTickets:listPlatformTickets"),
  get: makeFunctionReference<"query", { ticketId: string }, PlatformTicketDetail | null>("supportTickets:getPlatformTicket"),
  create: makeFunctionReference<"mutation", { subject: string; description: string; category: PlatformTicketCategory; priority: PlatformTicket["priority"]; tenantId?: string; marketId?: string }, string>("supportTickets:createPlatformTicket"),
  update: makeFunctionReference<"mutation", { ticketId: string; subject?: string; description?: string; category?: PlatformTicketCategory; priority?: PlatformTicket["priority"]; ticketStatus?: PlatformTicketStatus }, { updated: boolean }>("supportTickets:updatePlatformTicket"),
  delete: makeFunctionReference<"mutation", { ticketId: string; reason: string }, { deleted: boolean }>("supportTickets:deletePlatformTicket"),
  restore: makeFunctionReference<"mutation", { ticketId: string }, { restored: boolean }>("supportTickets:restorePlatformTicket"),
};
