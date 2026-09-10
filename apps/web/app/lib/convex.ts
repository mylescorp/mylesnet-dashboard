"use client";

import { useQuery as baseUseQuery } from "convex/react";
import type { OptionalRestArgsOrSkip } from "convex/react";
import type { FunctionReference } from "convex/server";

export { ConvexProviderWithAuth, ConvexReactClient, useAction, useConvexAuth, useMutation } from "convex/react";

/**
 * Typed wrapper over `convex/react`'s `useQuery`.
 *
 * The library's own signature can fall back to an `any` return when TypeScript
 * fails to infer the `Query` generic from both the query reference and its
 * rest-args tuple. `NoInfer` forces inference to come from the query reference
 * alone, so the hook returns the exact query result type.
 */
export function useQuery<Query extends FunctionReference<"query">>(
  query: Query,
  ...args: OptionalRestArgsOrSkip<NoInfer<Query>>
): Query["_returnType"] | undefined {
  return baseUseQuery(query, ...args);
}