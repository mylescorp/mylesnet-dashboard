import { makeFunctionReference } from "convex/server";
import type { PaginationResult } from "convex/server";

export type PlatformApiKey = {
  _id: string; name: string; prefix: string; scopes: string[];
  createdAt: number; expiresAt: number | null; revokedAt: number | null;
};
type PageArgs = { paginationOpts: { numItems: number; cursor: string | null } };
export const platformApiKeys = {
  list: makeFunctionReference<"query", PageArgs, PaginationResult<PlatformApiKey>>("platformApiKeys:list"),
  create: makeFunctionReference<"mutation", { name: string; scopes: string[]; expiresAt?: number }, { id: string; token: string }>("platformApiKeys:create"),
  update: makeFunctionReference<"mutation", { keyId: string; name?: string; scopes?: string[]; expiresAt?: number | null }, { updated: boolean }>("platformApiKeys:update"),
  revoke: makeFunctionReference<"mutation", { keyId: string }, { revoked: boolean }>("platformApiKeys:revoke"),
};
