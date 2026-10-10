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
import type * as auditLogTenant from "../auditLogTenant.js";
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
import type * as fleet from "../fleet.js";
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
import type * as lib_commissionScopeCore from "../lib/commissionScopeCore.js";
import type * as lib_featureFlagCore from "../lib/featureFlagCore.js";
import type * as lib_finance from "../lib/finance.js";
import type * as lib_fleetCore from "../lib/fleetCore.js";
import type * as lib_mfa from "../lib/mfa.js";
import type * as lib_migrationRunCore from "../lib/migrationRunCore.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_payoutLifecycleCore from "../lib/payoutLifecycleCore.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_platformApiKeysCore from "../lib/platformApiKeysCore.js";
import type * as lib_platformBillingAnomalyCore from "../lib/platformBillingAnomalyCore.js";
import type * as lib_platformCommissionRateCore from "../lib/platformCommissionRateCore.js";
import type * as lib_platformLeaderboardCore from "../lib/platformLeaderboardCore.js";
import type * as lib_platformMarketsCore from "../lib/platformMarketsCore.js";
import type * as lib_platformPartnerLifecycleCore from "../lib/platformPartnerLifecycleCore.js";
import type * as lib_platformRadiusCore from "../lib/platformRadiusCore.js";
import type * as lib_platformReconciliationCore from "../lib/platformReconciliationCore.js";
import type * as lib_platformRevenueCore from "../lib/platformRevenueCore.js";
import type * as lib_platformRoleCore from "../lib/platformRoleCore.js";
import type * as lib_provisioningCore from "../lib/provisioningCore.js";
import type * as lib_sha256 from "../lib/sha256.js";
import type * as lib_signup from "../lib/signup.js";
import type * as lib_tenant from "../lib/tenant.js";
import type * as lib_tenantContracts from "../lib/tenantContracts.js";
import type * as lib_tenantCore from "../lib/tenantCore.js";
import type * as lib_tenantIsolationCore from "../lib/tenantIsolationCore.js";
import type * as lib_tenantLifecycleCore from "../lib/tenantLifecycleCore.js";
import type * as lib_tenantMigration from "../lib/tenantMigration.js";
import type * as lib_tenantProvisioning from "../lib/tenantProvisioning.js";
import type * as lib_tenantSubscriberCountCore from "../lib/tenantSubscriberCountCore.js";
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
import type * as platformAnalytics from "../platformAnalytics.js";
import type * as platformApiKeys from "../platformApiKeys.js";
import type * as platformBillingAnomalies from "../platformBillingAnomalies.js";
import type * as platformCommissionRates from "../platformCommissionRates.js";
import type * as platformDataRequests from "../platformDataRequests.js";
import type * as platformLeaderboard from "../platformLeaderboard.js";
import type * as platformMarkets from "../platformMarkets.js";
import type * as platformPartners from "../platformPartners.js";
import type * as platformPlans from "../platformPlans.js";
import type * as platformPolicyTemplates from "../platformPolicyTemplates.js";
import type * as platformRadius from "../platformRadius.js";
import type * as platformReconciliation from "../platformReconciliation.js";
import type * as platformRevenue from "../platformRevenue.js";
import type * as platformSla from "../platformSla.js";
import type * as platformUserDirectory from "../platformUserDirectory.js";
import type * as platformUsers from "../platformUsers.js";
import type * as platformVoucherPackages from "../platformVoucherPackages.js";
import type * as platformWhiteLabel from "../platformWhiteLabel.js";
import type * as profile from "../profile.js";
import type * as provisioning from "../provisioning.js";
import type * as rolesAdmin from "../rolesAdmin.js";
import type * as rolesInternal from "../rolesInternal.js";
import type * as scheduledReports from "../scheduledReports.js";
import type * as seed from "../seed.js";
import type * as signup from "../signup.js";
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
import type * as workspaceSettings from "../workspaceSettings.js";

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
  auditLogTenant: typeof auditLogTenant;
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
  fleet: typeof fleet;
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
  "lib/commissionScopeCore": typeof lib_commissionScopeCore;
  "lib/featureFlagCore": typeof lib_featureFlagCore;
  "lib/finance": typeof lib_finance;
  "lib/fleetCore": typeof lib_fleetCore;
  "lib/mfa": typeof lib_mfa;
  "lib/migrationRunCore": typeof lib_migrationRunCore;
  "lib/notify": typeof lib_notify;
  "lib/payoutLifecycleCore": typeof lib_payoutLifecycleCore;
  "lib/permissions": typeof lib_permissions;
  "lib/platformApiKeysCore": typeof lib_platformApiKeysCore;
  "lib/platformBillingAnomalyCore": typeof lib_platformBillingAnomalyCore;
  "lib/platformCommissionRateCore": typeof lib_platformCommissionRateCore;
  "lib/platformLeaderboardCore": typeof lib_platformLeaderboardCore;
  "lib/platformMarketsCore": typeof lib_platformMarketsCore;
  "lib/platformPartnerLifecycleCore": typeof lib_platformPartnerLifecycleCore;
  "lib/platformRadiusCore": typeof lib_platformRadiusCore;
  "lib/platformReconciliationCore": typeof lib_platformReconciliationCore;
  "lib/platformRevenueCore": typeof lib_platformRevenueCore;
  "lib/platformRoleCore": typeof lib_platformRoleCore;
  "lib/provisioningCore": typeof lib_provisioningCore;
  "lib/sha256": typeof lib_sha256;
  "lib/signup": typeof lib_signup;
  "lib/tenant": typeof lib_tenant;
  "lib/tenantContracts": typeof lib_tenantContracts;
  "lib/tenantCore": typeof lib_tenantCore;
  "lib/tenantIsolationCore": typeof lib_tenantIsolationCore;
  "lib/tenantLifecycleCore": typeof lib_tenantLifecycleCore;
  "lib/tenantMigration": typeof lib_tenantMigration;
  "lib/tenantProvisioning": typeof lib_tenantProvisioning;
  "lib/tenantSubscriberCountCore": typeof lib_tenantSubscriberCountCore;
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
  platformAnalytics: typeof platformAnalytics;
  platformApiKeys: typeof platformApiKeys;
  platformBillingAnomalies: typeof platformBillingAnomalies;
  platformCommissionRates: typeof platformCommissionRates;
  platformDataRequests: typeof platformDataRequests;
  platformLeaderboard: typeof platformLeaderboard;
  platformMarkets: typeof platformMarkets;
  platformPartners: typeof platformPartners;
  platformPlans: typeof platformPlans;
  platformPolicyTemplates: typeof platformPolicyTemplates;
  platformRadius: typeof platformRadius;
  platformReconciliation: typeof platformReconciliation;
  platformRevenue: typeof platformRevenue;
  platformSla: typeof platformSla;
  platformUserDirectory: typeof platformUserDirectory;
  platformUsers: typeof platformUsers;
  platformVoucherPackages: typeof platformVoucherPackages;
  platformWhiteLabel: typeof platformWhiteLabel;
  profile: typeof profile;
  provisioning: typeof provisioning;
  rolesAdmin: typeof rolesAdmin;
  rolesInternal: typeof rolesInternal;
  scheduledReports: typeof scheduledReports;
  seed: typeof seed;
  signup: typeof signup;
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
  workspaceSettings: typeof workspaceSettings;
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
