import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type PaymentGatewayConfig = {
  _id: string;
  tenantId: string;
  tenantName: string | null;
  provider: "daraja";
  environment: "sandbox" | "production";
  shortCode: string;
  enabled: boolean;
  credentialsConfigured: boolean;
  rotationPending: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

type PageOpts = { paginationOpts: { numItems: number; cursor: string | null }; includeArchived?: boolean };

export const platformPaymentGateways = {
  recordSettingsView: makeFunctionReference<"mutation", Record<string, never>, { recorded: boolean }>("platform:recordPaymentGatewaySettingsView"),
  list: makeFunctionReference<"query", PageOpts, PaginationResult<PaymentGatewayConfig>>("platform:listPaymentGatewayConfigs"),
  get: makeFunctionReference<"query", { configId: string }, PaymentGatewayConfig | null>("platform:getPaymentGatewayConfig"),
  create: makeFunctionReference<"mutation", { tenantId: string; environment: "sandbox" | "production"; shortCode: string }, string>("platform:createPaymentGatewayConfig"),
  updatePublicFields: makeFunctionReference<"mutation", { tenantId: string; environment?: "sandbox" | "production"; shortCode?: string; enabled?: boolean }, { updated: boolean }>("platform:updatePaymentGatewayPublicFields"),
  archive: makeFunctionReference<"mutation", { configId: string }, { archived: boolean }>("platform:archivePaymentGatewayConfig"),
  restore: makeFunctionReference<"mutation", { configId: string }, { restored: boolean }>("platform:restorePaymentGatewayConfig"),
  beginRotation: makeFunctionReference<"mutation", { configId: string; operationId: string }, { started: boolean; alreadyStarted: boolean }>("platform:beginPaymentGatewayCredentialRotation"),
  completeRotation: makeFunctionReference<"mutation", { configId: string; operationId: string; versionId: string }, { credentialsConfigured: boolean }>("platform:completePaymentGatewayCredentialRotation"),
  failRotation: makeFunctionReference<"mutation", { configId: string; operationId: string }, { cleared: boolean }>("platform:failPaymentGatewayCredentialRotation"),
};
