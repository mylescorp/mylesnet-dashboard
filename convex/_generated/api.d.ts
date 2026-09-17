/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as agentActivity from "../agentActivity.js";
import type * as agentInvitations from "../agentInvitations.js";
import type * as agents from "../agents.js";
import type * as analytics from "../analytics.js";
import type * as auditChainVerify from "../auditChainVerify.js";
import type * as auditHashChain from "../auditHashChain.js";
import type * as auth from "../auth.js";
import type * as bootstrap from "../bootstrap.js";
import type * as broadcasts from "../broadcasts.js";
import type * as commissions from "../commissions.js";
import type * as costAllocation from "../costAllocation.js";
import type * as crons from "../crons.js";
import type * as dailySnapshots from "../dailySnapshots.js";
import type * as dashboard from "../dashboard.js";
import type * as expenses from "../expenses.js";
import type * as featureFlags from "../featureFlags.js";
import type * as forex from "../forex.js";
import type * as http from "../http.js";
import type * as investors from "../investors.js";
import type * as invitations from "../invitations.js";
import type * as invitationsInternal from "../invitationsInternal.js";
import type * as invoices from "../invoices.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_auditChainCore from "../lib/auditChainCore.js";
import type * as lib_auditChainVerifyCore from "../lib/auditChainVerifyCore.js";
import type * as lib_auditHashCore from "../lib/auditHashCore.js";
import type * as lib_auditLog from "../lib/auditLog.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_featureFlagCore from "../lib/featureFlagCore.js";
import type * as lib_finance from "../lib/finance.js";
import type * as lib_mfa from "../lib/mfa.js";
import type * as lib_migrationRunCore from "../lib/migrationRunCore.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_provisioningCore from "../lib/provisioningCore.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as lib_tenantContracts from "../lib/tenantContracts.js";
import type * as lib_tenantCore from "../lib/tenantCore.js";
import type * as lib_tenantIsolationCore from "../lib/tenantIsolationCore.js";
import type * as lib_tenantMigration from "../lib/tenantMigration.js";
import type * as lib_tenantProvisioning from "../lib/tenantProvisioning.js";
import type * as lib_voucherFraudCore from "../lib/voucherFraudCore.js";
import type * as lib_workosIdentity from "../lib/workosIdentity.js";
import type * as lib_workosVerify from "../lib/workosVerify.js";
import type * as marketProspects from "../marketProspects.js";
import type * as markets from "../markets.js";
import type * as networkOps from "../networkOps.js";
import type * as notifications from "../notifications.js";
import type * as organizations from "../organizations.js";
import type * as osMigrations from "../osMigrations.js";
import type * as payments from "../payments.js";
import type * as payouts from "../payouts.js";
import type * as plans from "../plans.js";
import type * as platform from "../platform.js";
import type * as platformUsers from "../platformUsers.js";
import type * as profile from "../profile.js";
import type * as rolesAdmin from "../rolesAdmin.js";
import type * as rolesInternal from "../rolesInternal.js";
import type * as scheduledReports from "../scheduledReports.js";
import type * as seed from "../seed.js";
import type * as subscriberDetail from "../subscriberDetail.js";
import type * as subscriberSnapshots from "../subscriberSnapshots.js";
import type * as subscribers from "../subscribers.js";
import type * as supportTickets from "../supportTickets.js";
import type * as teams from "../teams.js";
import type * as tenantControl from "../tenantControl.js";
import type * as tenantMigrations from "../tenantMigrations.js";
import type * as voucherFraud from "../voucherFraud.js";
import type * as vouchers from "../vouchers.js";
import type * as workos from "../workos.js";
import type * as workosWebhook from "../workosWebhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  agentActivity: typeof agentActivity;
  agentInvitations: typeof agentInvitations;
  agents: typeof agents;
  analytics: typeof analytics;
  auditChainVerify: typeof auditChainVerify;
  auditHashChain: typeof auditHashChain;
  auth: typeof auth;
  bootstrap: typeof bootstrap;
  broadcasts: typeof broadcasts;
  commissions: typeof commissions;
  costAllocation: typeof costAllocation;
  crons: typeof crons;
  dailySnapshots: typeof dailySnapshots;
  dashboard: typeof dashboard;
  expenses: typeof expenses;
  featureFlags: typeof featureFlags;
  forex: typeof forex;
  http: typeof http;
  investors: typeof investors;
  invitations: typeof invitations;
  invitationsInternal: typeof invitationsInternal;
  invoices: typeof invoices;
  leaderboard: typeof leaderboard;
  "lib/auditChainCore": typeof lib_auditChainCore;
  "lib/auditChainVerifyCore": typeof lib_auditChainVerifyCore;
  "lib/auditHashCore": typeof lib_auditHashCore;
  "lib/auditLog": typeof lib_auditLog;
  "lib/auth": typeof lib_auth;
  "lib/featureFlagCore": typeof lib_featureFlagCore;
  "lib/finance": typeof lib_finance;
  "lib/mfa": typeof lib_mfa;
  "lib/migrationRunCore": typeof lib_migrationRunCore;
  "lib/notify": typeof lib_notify;
  "lib/permissions": typeof lib_permissions;
  "lib/provisioningCore": typeof lib_provisioningCore;
  "lib/tenant": typeof lib_tenant;
  "lib/tenantContracts": typeof lib_tenantContracts;
  "lib/tenantCore": typeof lib_tenantCore;
  "lib/tenantIsolationCore": typeof lib_tenantIsolationCore;
  "lib/tenantMigration": typeof lib_tenantMigration;
  "lib/tenantProvisioning": typeof lib_tenantProvisioning;
  "lib/voucherFraudCore": typeof lib_voucherFraudCore;
  "lib/workosIdentity": typeof lib_workosIdentity;
  "lib/workosVerify": typeof lib_workosVerify;
  marketProspects: typeof marketProspects;
  markets: typeof markets;
  networkOps: typeof networkOps;
  notifications: typeof notifications;
  organizations: typeof organizations;
  osMigrations: typeof osMigrations;
  payments: typeof payments;
  payouts: typeof payouts;
  plans: typeof plans;
  platform: typeof platform;
  platformUsers: typeof platformUsers;
  profile: typeof profile;
  rolesAdmin: typeof rolesAdmin;
  rolesInternal: typeof rolesInternal;
  scheduledReports: typeof scheduledReports;
  seed: typeof seed;
  subscriberDetail: typeof subscriberDetail;
  subscriberSnapshots: typeof subscriberSnapshots;
  subscribers: typeof subscribers;
  supportTickets: typeof supportTickets;
  teams: typeof teams;
  tenantControl: typeof tenantControl;
  tenantMigrations: typeof tenantMigrations;
  voucherFraud: typeof voucherFraud;
  vouchers: typeof vouchers;
  workos: typeof workos;
  workosWebhook: typeof workosWebhook;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
