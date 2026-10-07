import { makeFunctionReference } from "convex/server";

export type PlatformVoucherPackageType = "half_day" | "day" | "week" | "month" | "specialty";
export type PlatformVoucherPackageStatus = "active" | "archived";
export type PlatformVoucherPackage = {
  _id: string; _creationTime: number; code: string; name: string; description: string; packageType: PlatformVoucherPackageType;
  durationHours: number; currency: string; priceEach: number; dataQuotaMb?: number; downloadMbps?: number; uploadMbps?: number;
  deviceLimit: number; status: PlatformVoucherPackageStatus; revision: number; createdBy: string; createdAt: number; updatedAt: number; updatedBy: string; deletedAt?: number; deletedBy?: string;
};
export type PlatformVoucherPackageFields = Omit<PlatformVoucherPackage, "_id" | "_creationTime" | "status" | "revision" | "createdBy" | "createdAt" | "updatedAt" | "updatedBy" | "deletedAt" | "deletedBy">;

export const platformVoucherPackages = {
  list: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null }; includeArchived?: boolean; includeDeleted?: boolean }, { items: PlatformVoucherPackage[]; continueCursor: string | null; isDone: boolean }>("platformVoucherPackages:list"),
  create: makeFunctionReference<"mutation", { fields: PlatformVoucherPackageFields }, string>("platformVoucherPackages:create"),
  update: makeFunctionReference<"mutation", { packageId: string; expectedRevision: number; fields: PlatformVoucherPackageFields }, { updated: boolean }>("platformVoucherPackages:update"),
  setStatus: makeFunctionReference<"mutation", { packageId: string; status: PlatformVoucherPackageStatus }, { updated: boolean }>("platformVoucherPackages:setStatus"),
  remove: makeFunctionReference<"mutation", { packageId: string; reason: string }, { deleted: boolean }>("platformVoucherPackages:remove"),
  restore: makeFunctionReference<"mutation", { packageId: string }, { restored: boolean }>("platformVoucherPackages:restore"),
};
