export function toEditedExpiryTimestamp(date: string, previous: number | undefined): number | null {
  if (!date) return null;
  const next = new Date(`${date}T00:00:00.000Z`);
  if (previous !== undefined) {
    const original = new Date(previous);
    next.setUTCHours(original.getUTCHours(), original.getUTCMinutes(), original.getUTCSeconds(), original.getUTCMilliseconds());
  }
  return next.getTime();
}
