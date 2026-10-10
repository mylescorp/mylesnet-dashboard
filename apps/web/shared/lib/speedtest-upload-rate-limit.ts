const WINDOW_MS = 60_000;
const MAX_UPLOADS_PER_WINDOW = 3;
const MAX_TRACKED_CLIENTS = 10_000;

const windows = new Map<string, { startedAt: number; requests: number }>();

/** Small per-runtime backstop; the public edge should also apply its shared rate policy. */
export function allowSpeedTestUpload(clientKey: string, now = Date.now()): boolean {
  const current = windows.get(clientKey);
  if (!current || now - current.startedAt >= WINDOW_MS || now < current.startedAt) {
    if (windows.size >= MAX_TRACKED_CLIENTS && !current) {
      const oldestKey = windows.keys().next().value;
      if (oldestKey !== undefined) windows.delete(oldestKey);
    }
    windows.set(clientKey, { startedAt: now, requests: 1 });
    return true;
  }
  if (current.requests >= MAX_UPLOADS_PER_WINDOW) return false;
  current.requests += 1;
  return true;
}
