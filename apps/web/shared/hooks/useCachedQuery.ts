"use client";

import { useQuery } from "@/app/lib/convex";
import type { FunctionReference } from "convex/server";
import { useMemo } from "react";

interface CachedQueryOptions {
  cacheTime?: number; // Cache duration in milliseconds (default: 60 seconds)
  enabled?: boolean;
}

/**
 * Hook for caching Convex query results to reduce unnecessary re-renders.
 * The actual caching is handled by Convex's built-in query caching and
 * reactivity; this hook exists as a placeholder for future explicit caching
 * needs if performance issues arise.
 */
export function useCachedQuery<Query extends FunctionReference<"query">>(
  queryFunction: Query,
  args: Query["_args"],
  options: CachedQueryOptions = {}
): Query["_returnType"] | undefined {
  const { enabled = true } = options;

  const freshData = useQuery(queryFunction, args);
  const gated = enabled ? freshData : undefined;

  const cachedResult = useMemo(() => {
    if (gated === undefined) return undefined;
    return gated;
  }, [gated]);

  return cachedResult;
}
