import { makeFunctionReference } from "convex/server";

export type PolicyTemplateKind = "pppoe" | "rate_limit";
export type PolicyTemplateStatus = "draft" | "published" | "retired";

export type PolicyTemplateRow = {
  _id: string;
  code: string;
  name: string;
  version: number;
  kind: PolicyTemplateKind;
  downloadMbps: number;
  uploadMbps: number;
  burstDownloadMbps: number | null;
  burstUploadMbps: number | null;
  burstThresholdMbps: number | null;
  burstTimeSeconds: number | null;
  status: PolicyTemplateStatus;
  description: string | null;
  createdBy: string | null;
  createdAt: number | null;
  updatedAt: number | null;
};

export const policyTemplates = {
  list: makeFunctionReference<
    "query",
    { kind?: string; status?: string; code?: string },
    PolicyTemplateRow[]
  >("policyTemplates:listPolicyTemplates"),
  get: makeFunctionReference<
    "query",
    { templateId: string },
    PolicyTemplateRow | null
  >("policyTemplates:getPolicyTemplateRow"),
  create: makeFunctionReference<
    "mutation",
    {
      code: string;
      name: string;
      kind: PolicyTemplateKind;
      downloadMbps: number;
      uploadMbps: number;
      burstDownloadMbps?: number;
      burstUploadMbps?: number;
      burstThresholdMbps?: number;
      burstTimeSeconds?: number;
      description?: string;
    },
    string
  >("policyTemplates:createPolicyTemplate"),
  createVersion: makeFunctionReference<
    "mutation",
    {
      code: string;
      name: string;
      downloadMbps: number;
      uploadMbps: number;
      burstDownloadMbps?: number;
      burstUploadMbps?: number;
      burstThresholdMbps?: number;
      burstTimeSeconds?: number;
      description?: string;
    },
    string
  >("policyTemplates:createPolicyTemplateVersion"),
  publish: makeFunctionReference<
    "mutation",
    { templateId: string },
    void
  >("policyTemplates:publishPolicyTemplate"),
  update: makeFunctionReference<
    "mutation",
    {
      templateId: string;
      name?: string;
      downloadMbps?: number;
      uploadMbps?: number;
      burstDownloadMbps?: number;
      burstUploadMbps?: number;
      burstThresholdMbps?: number;
      burstTimeSeconds?: number;
      description?: string;
    },
    void
  >("policyTemplates:updatePolicyTemplate"),
  retire: makeFunctionReference<
    "mutation",
    { templateId: string },
    void
  >("policyTemplates:retirePolicyTemplate"),
};
