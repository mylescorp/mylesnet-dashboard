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
import type * as configWatch from "../configWatch.js";
import type * as cron from "../cron.js";
import type * as dashboard from "../dashboard.js";
import type * as healthSamples from "../healthSamples.js";
import type * as incidents from "../incidents.js";
import type * as routeros from "../routeros.js";
import type * as routers from "../routers.js";
import type * as shiftNotes from "../shiftNotes.js";
import type * as usage from "../usage.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accessPoints: typeof accessPoints;
  configWatch: typeof configWatch;
  cron: typeof cron;
  dashboard: typeof dashboard;
  healthSamples: typeof healthSamples;
  incidents: typeof incidents;
  routeros: typeof routeros;
  routers: typeof routers;
  shiftNotes: typeof shiftNotes;
  usage: typeof usage;
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
