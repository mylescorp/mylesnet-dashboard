import { makeFunctionReference } from "convex/server";

export type SlaCategory = "network" | "billing" | "account";
export type PlatformSlaPolicy = { _id: string; category: SlaCategory; firstResponseMinutes: number; resolutionMinutes: number; createdAt: number; updatedAt: number };

export const platformSla = {
  list: makeFunctionReference<"query", Record<string, never>, PlatformSlaPolicy[]>("platformSla:list"),
  create: makeFunctionReference<"mutation", { category: SlaCategory; firstResponseMinutes: number; resolutionMinutes: number }, string>("platformSla:create"),
  update: makeFunctionReference<"mutation", { policyId: string; firstResponseMinutes: number; resolutionMinutes: number }, string>("platformSla:update"),
  remove: makeFunctionReference<"mutation", { policyId: string }, { deleted: boolean }>("platformSla:remove"),
};
