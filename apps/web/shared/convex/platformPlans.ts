import { makeFunctionReference } from "convex/server";

export type PlatformPlan = {
  _id: string;
  code: string;
  name: string;
  currency: "KES";
  monthlyPriceMinor: number;
  status: "active" | "archived";
  createdAt: number;
  updatedAt: number;
};

export type PublicPlatformPlan = { code: string; name: string; currency: "KES"; monthlyPriceMinor: number };

export const platformPlans = {
  list: makeFunctionReference<"query", Record<string, never>, PlatformPlan[]>("platformPlans:list"),
  listPublic: makeFunctionReference<"query", Record<string, never>, PublicPlatformPlan[]>("platformPlans:listPublic"),
  create: makeFunctionReference<"mutation", { code: string; name: string; monthlyPriceMinor: number }, string>("platformPlans:create"),
  update: makeFunctionReference<"mutation", { code: string; name: string; monthlyPriceMinor: number }, string>("platformPlans:update"),
  setStatus: makeFunctionReference<"mutation", { code: string; status: "active" | "archived" }, { changed: boolean; status: "active" | "archived" }>("platformPlans:setStatus"),
  remove: makeFunctionReference<"mutation", { code: string }, { deleted: boolean; code: string }>("platformPlans:remove"),
};
