import { makeFunctionReference } from "convex/server";

export type FeatureFlag = {
  _id: string;
  key: string;
  valueJson: string;
  enabled: boolean;
  description?: string | null;
  tenantIds?: string[] | null;
  createdBy?: string | null;
  createdAt?: number | null;
  updatedAt: number;
  updatedBy?: string | null;
};

export type FeatureFlagEvaluation = {
  key: string;
  enabled: boolean;
  rolloutPercent: number | null;
  tenantOverride: string[] | null;
  effectiveOn: boolean;
};

/**
 * Temporary explicit references while the generated Convex API remains pinned
 * to the last approved non-production deployment. Do not regenerate bindings
 * until the Convex target is explicitly verified.
 */
export const featureFlags = {
  list: makeFunctionReference<"query", Record<string, never>, FeatureFlag[]>("featureFlags:listFeatureFlags"),
  get: makeFunctionReference<
    "query",
    { key: string },
    FeatureFlag | null
  >("featureFlags:getFeatureFlag"),
  set: makeFunctionReference<
    "mutation",
    {
      key: string;
      valueJson: string;
      enabled: boolean;
      description?: string;
      tenantIds?: string[];
    },
    string
  >("featureFlags:setFeatureFlag"),
  remove: makeFunctionReference<
    "mutation",
    { key: string },
    void
  >("featureFlags:removeFeatureFlag"),
  evaluate: makeFunctionReference<
    "query",
    { key: string; tenantId?: string },
    FeatureFlagEvaluation | null
  >("featureFlags:evaluateFeatureFlag"),
};