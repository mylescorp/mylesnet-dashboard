/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accessPoints from "../accessPoints.js";
import type * as agentActivity from "../agentActivity.js";
import type * as agentInvitations from "../agentInvitations.js";
import type * as agents from "../agents.js";
import type * as alerts from "../alerts.js";
import type * as analytics from "../analytics.js";
import type * as auth from "../auth.js";
import type * as bootstrap from "../bootstrap.js";
import type * as broadcasts from "../broadcasts.js";
import type * as capacityPlanning from "../capacityPlanning.js";
import type * as centipid from "../centipid.js";
import type * as collector from "../collector.js";
import type * as commissions from "../commissions.js";
import type * as configWatch from "../configWatch.js";
import type * as costAllocation from "../costAllocation.js";
import type * as cron from "../cron.js";
import type * as crons from "../crons.js";
import type * as dailySnapshots from "../dailySnapshots.js";
import type * as dashboard from "../dashboard.js";
import type * as debug from "../debug.js";
import type * as devices from "../devices.js";
import type * as expenses from "../expenses.js";
import type * as forex from "../forex.js";
import type * as healthSamples from "../healthSamples.js";
import type * as http from "../http.js";
import type * as incidents from "../incidents.js";
import type * as investors from "../investors.js";
import type * as invitations from "../invitations.js";
import type * as invitationsInternal from "../invitationsInternal.js";
import type * as leaderboard from "../leaderboard.js";
import type * as lib_auditLog from "../lib/auditLog.js";
import type * as lib_auth from "../lib/auth.js";
import type * as lib_centipidCredentials from "../lib/centipidCredentials.js";
import type * as lib_centipidVerify from "../lib/centipidVerify.js";
import type * as lib_finance from "../lib/finance.js";
import type * as lib_notify from "../lib/notify.js";
import type * as lib_permissions from "../lib/permissions.js";
import type * as lib_routerCredentials from "../lib/routerCredentials.js";
import type * as lib_workosVerify from "../lib/workosVerify.js";
import type * as maintenance from "../maintenance.js";
import type * as marketProspects from "../marketProspects.js";
import type * as markets from "../markets.js";
import type * as networkSwitches from "../networkSwitches.js";
import type * as notifications from "../notifications.js";
import type * as operations from "../operations.js";
import type * as organizations from "../organizations.js";
import type * as osMigrations from "../osMigrations.js";
import type * as payouts from "../payouts.js";
import type * as plans from "../plans.js";
import type * as platform from "../platform.js";
import type * as platformUsers from "../platformUsers.js";
import type * as profile from "../profile.js";
import type * as renewalCredits from "../renewalCredits.js";
import type * as riskCenter from "../riskCenter.js";
import type * as rolesAdmin from "../rolesAdmin.js";
import type * as rolesInternal from "../rolesInternal.js";
import type * as rollups from "../rollups.js";
import type * as routerCredentialActions from "../routerCredentialActions.js";
import type * as routeros from "../routeros.js";
import type * as routers from "../routers.js";
import type * as scheduledReports from "../scheduledReports.js";
import type * as shiftNotes from "../shiftNotes.js";
import type * as siteKit from "../siteKit.js";
import type * as siteTelemetry from "../siteTelemetry.js";
import type * as subscriberSnapshots from "../subscriberSnapshots.js";
import type * as supportTickets from "../supportTickets.js";
import type * as teams from "../teams.js";
import type * as thresholds from "../thresholds.js";
import type * as trash from "../trash.js";
import type * as usage from "../usage.js";
import type * as vouchers from "../vouchers.js";
import type * as workos from "../workos.js";
import type * as workosWebhook from "../workosWebhook.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessPoints: typeof accessPoints;
  agentActivity: typeof agentActivity;
  agentInvitations: typeof agentInvitations;
  agents: typeof agents;
  alerts: typeof alerts;
  analytics: typeof analytics;
  auth: typeof auth;
  bootstrap: typeof bootstrap;
  broadcasts: typeof broadcasts;
  capacityPlanning: typeof capacityPlanning;
  centipid: typeof centipid;
  collector: typeof collector;
  commissions: typeof commissions;
  configWatch: typeof configWatch;
  costAllocation: typeof costAllocation;
  cron: typeof cron;
  crons: typeof crons;
  dailySnapshots: typeof dailySnapshots;
  dashboard: typeof dashboard;
  debug: typeof debug;
  devices: typeof devices;
  expenses: typeof expenses;
  forex: typeof forex;
  healthSamples: typeof healthSamples;
  http: typeof http;
  incidents: typeof incidents;
  investors: typeof investors;
  invitations: typeof invitations;
  invitationsInternal: typeof invitationsInternal;
  leaderboard: typeof leaderboard;
  "lib/auditLog": typeof lib_auditLog;
  "lib/auth": typeof lib_auth;
  "lib/centipidCredentials": typeof lib_centipidCredentials;
  "lib/centipidVerify": typeof lib_centipidVerify;
  "lib/finance": typeof lib_finance;
  "lib/notify": typeof lib_notify;
  "lib/permissions": typeof lib_permissions;
  "lib/routerCredentials": typeof lib_routerCredentials;
  "lib/workosVerify": typeof lib_workosVerify;
  maintenance: typeof maintenance;
  marketProspects: typeof marketProspects;
  markets: typeof markets;
  networkSwitches: typeof networkSwitches;
  notifications: typeof notifications;
  operations: typeof operations;
  organizations: typeof organizations;
  osMigrations: typeof osMigrations;
  payouts: typeof payouts;
  plans: typeof plans;
  platform: typeof platform;
  platformUsers: typeof platformUsers;
  profile: typeof profile;
  renewalCredits: typeof renewalCredits;
  riskCenter: typeof riskCenter;
  rolesAdmin: typeof rolesAdmin;
  rolesInternal: typeof rolesInternal;
  rollups: typeof rollups;
  routerCredentialActions: typeof routerCredentialActions;
  routeros: typeof routeros;
  routers: typeof routers;
  scheduledReports: typeof scheduledReports;
  shiftNotes: typeof shiftNotes;
  siteKit: typeof siteKit;
  siteTelemetry: typeof siteTelemetry;
  subscriberSnapshots: typeof subscriberSnapshots;
  supportTickets: typeof supportTickets;
  teams: typeof teams;
  thresholds: typeof thresholds;
  trash: typeof trash;
  usage: typeof usage;
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
