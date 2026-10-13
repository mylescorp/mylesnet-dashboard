import { makeFunctionReference } from "convex/server";

export type PlatformWhiteLabelDefaults = {
  supportEmail: string;
  supportPhone: string;
  brandColor: string;
  configured: boolean;
  updatedAt: number | null;
};

export const platformWhiteLabel = {
  get: makeFunctionReference<"query", Record<string, never>, PlatformWhiteLabelDefaults>("platformWhiteLabel:get"),
  save: makeFunctionReference<"mutation", { supportEmail: string; supportPhone: string; brandColor: string }, PlatformWhiteLabelDefaults>("platformWhiteLabel:save"),
  reset: makeFunctionReference<"mutation", Record<string, never>, Omit<PlatformWhiteLabelDefaults, "updatedAt">>("platformWhiteLabel:reset"),
};
