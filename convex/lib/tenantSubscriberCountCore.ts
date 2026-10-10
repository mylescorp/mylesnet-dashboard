/** Return the next count while leaving an unbackfilled total unknown. */
export function subscriberCountAfterChange(current: number | undefined, delta: -1 | 1): number | undefined {
  if (current === undefined) return undefined;
  return Math.max(0, current + delta);
}

export function canWriteSubscriberCount(backfillRunning: boolean | undefined): boolean {
  return backfillRunning !== true;
}
