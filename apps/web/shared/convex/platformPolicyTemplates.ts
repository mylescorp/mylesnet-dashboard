import { makeFunctionReference } from "convex/server";

export type PolicyAccessType = "pppoe" | "hotspot" | "both";
export type PolicyStatus = "active" | "archived";
export type PolicyFields = {
  downloadMbps: number; uploadMbps: number; burstDownloadMbps?: number; burstUploadMbps?: number;
  burstThresholdPercent?: number; burstWindowSeconds?: number; concurrentSessions: number; deviceLimit: number;
  dataQuotaGb?: number; timeQuotaHours?: number; fairUseAfterGb?: number; fairUseDownloadMbps?: number; fairUseUploadMbps?: number;
  vlanId?: number; ipPool?: string; staticIpAllowed: boolean; dnsServers: string[]; scheduleStart?: string; scheduleEnd?: string;
  idleTimeoutMinutes?: number; sessionTimeoutHours?: number; firewallProfile?: string; serviceEnabled: boolean;
};
export type PolicyVersion = PolicyFields & {
  _id: string; _creationTime: number; templateId: string; version: number; changeNote: string; createdBy: string; createdAt: number;
};
export type PolicyTemplate = {
  _id: string; _creationTime: number; code: string; name: string; description: string; accessType: PolicyAccessType;
  currentVersion: number; status: PolicyStatus; createdBy: string; createdAt: number; updatedAt: number; updatedBy: string;
  deletedAt?: number; deletedBy?: string;
};
export type PolicyTemplateWithCurrent = { template: PolicyTemplate; current: PolicyVersion | null };

export const platformPolicyTemplates = {
  list: makeFunctionReference<"query", { paginationOpts: { numItems: number; cursor: string | null }; includeArchived?: boolean; includeDeleted?: boolean }, { items: PolicyTemplateWithCurrent[]; continueCursor: string | null; isDone: boolean }>("platformPolicyTemplates:list"),
  get: makeFunctionReference<"query", { templateId: string }, (PolicyTemplateWithCurrent & { versions: PolicyVersion[] }) | null>("platformPolicyTemplates:get"),
  create: makeFunctionReference<"mutation", { code: string; name: string; description: string; accessType: PolicyAccessType; fields: PolicyFields; changeNote: string }, string>("platformPolicyTemplates:create"),
  update: makeFunctionReference<"mutation", { templateId: string; expectedVersion: number; name: string; description: string; accessType: PolicyAccessType; fields: PolicyFields; changeNote: string }, number>("platformPolicyTemplates:update"),
  restoreVersion: makeFunctionReference<"mutation", { templateId: string; version: number; changeNote: string }, number>("platformPolicyTemplates:restoreVersion"),
  setStatus: makeFunctionReference<"mutation", { templateId: string; status: PolicyStatus }, { updated: boolean }>("platformPolicyTemplates:setStatus"),
  remove: makeFunctionReference<"mutation", { templateId: string; reason: string }, { deleted: boolean }>("platformPolicyTemplates:remove"),
  restore: makeFunctionReference<"mutation", { templateId: string }, { restored: boolean }>("platformPolicyTemplates:restore"),
};
