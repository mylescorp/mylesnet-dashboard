import { makeFunctionReference } from "convex/server";

export type DirectoryMembership = {
  tenantId: string;
  tenantName: string;
  role: string;
  status: "active" | "pending" | "revoked";
};
export type DirectoryUser = {
  _id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  status: "active" | "disabled" | "removed";
  platformRoles: string[];
  tenantMemberships: DirectoryMembership[];
  hasMoreTenantMemberships: boolean;
};

export const platformUserDirectory = {
  list: makeFunctionReference<
    "query",
    { paginationOpts: { numItems: number; cursor: string | null }; email?: string },
    { items: DirectoryUser[]; continueCursor: string | null; isDone: boolean }
  >("platformUserDirectory:list"),
  updateMembership: makeFunctionReference<
    "action",
    { userId: string; tenantId: string; status: "active" | "revoked" },
    { updated: boolean }
  >("platformUserDirectory:updateMembership"),
  sendPasswordReset: makeFunctionReference<
    "action",
    { userId: string },
    { sent: boolean }
  >("platformUserDirectory:sendPasswordReset"),
};
