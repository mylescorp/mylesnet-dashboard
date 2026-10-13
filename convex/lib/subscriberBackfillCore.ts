/** Pick the saved checkpoint for a stale run, or clean state for a fresh scan. */
export function subscriberBackfillStartState(
  resumeStaleRun: boolean,
  savedCursor: string | undefined,
  savedProgress: number | undefined,
): { cursor: string | null; progress: number } {
  return resumeStaleRun
    ? { cursor: savedCursor ?? null, progress: savedProgress ?? 0 }
    : { cursor: null, progress: 0 };
}
