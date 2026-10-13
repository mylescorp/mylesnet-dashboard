/**
 * Platform session policy — pure and dependency-free.
 *
 * The owner-approved values live here and only here: 30 minutes of inactivity
 * ends a platform session, the user is warned at 25 minutes, and the absolute
 * session lifetime is 12 hours. The same module drives the server-side gate in
 * the platform layout and the client-side inactivity guard, so the two can
 * never disagree. See `docs/auth/README.md` and `docs/decisions.md`.
 *
 * Nothing here imports Next.js, React, or the DOM: it runs in the server
 * runtime, in the browser, and under `node --test`.
 */

export interface PlatformSessionPolicy {
  /** Idle time that ends the session. */
  readonly inactivityMs: number;
  /** Idle time at which the warning appears. */
  readonly warningMs: number;
  /** Hard cap measured from the original authentication time. */
  readonly absoluteMs: number;
}

/** The single approved platform session policy (30 / 25 / 720 minutes). */
export const PLATFORM_SESSION_POLICY: PlatformSessionPolicy = Object.freeze({
  inactivityMs: 30 * 60 * 1000,
  warningMs: 25 * 60 * 1000,
  absoluteMs: 12 * 60 * 60 * 1000,
});

export type PlatformSessionState = "active" | "warning" | "expired";

export type PlatformSessionExpiryReason = "inactivity" | "absolute";

export interface PlatformSessionSnapshot {
  readonly state: PlatformSessionState;
  /** Present only when `state` is "expired". */
  readonly reason?: PlatformSessionExpiryReason;
  /** Milliseconds of inactivity left before the idle timeout (0 once passed). */
  readonly msUntilIdleExpiry: number;
  /** Milliseconds left before the absolute cap, or null when the sign-in time is unknown. */
  readonly msUntilAbsoluteExpiry: number | null;
  /** Milliseconds of inactivity left before the warning appears (0 once shown). */
  readonly msUntilWarning: number;
}

export interface PlatformSessionInput {
  readonly nowMs: number;
  readonly lastActivityMs: number;
  /** Original authentication time, or null when the server cannot supply it. */
  readonly sessionStartedMs: number | null;
  readonly policy?: PlatformSessionPolicy;
}

const ACTIVITY_KEY_PREFIX = "mylesnet:platform-session-activity:";
const STARTED_KEY_PREFIX = "mylesnet:platform-session-started:";

/**
 * Reduce the current time, recent activity, and the sign-in time to a single
 * policy snapshot. The absolute cap always wins over the idle timeout, because
 * it cannot be extended by activity.
 */
export function evaluatePlatformSession(input: PlatformSessionInput): PlatformSessionSnapshot {
  const policy = input.policy ?? PLATFORM_SESSION_POLICY;
  const idleMs = Math.max(0, input.nowMs - input.lastActivityMs);
  const msUntilIdleExpiry = Math.max(0, policy.inactivityMs - idleMs);
  const msUntilWarning = Math.max(0, policy.warningMs - idleMs);
  const msUntilAbsoluteExpiry =
    input.sessionStartedMs === null
      ? null
      : Math.max(0, policy.absoluteMs - Math.max(0, input.nowMs - input.sessionStartedMs));

  if (msUntilAbsoluteExpiry !== null && msUntilAbsoluteExpiry <= 0) {
    return {
      state: "expired",
      reason: "absolute",
      msUntilIdleExpiry,
      msUntilAbsoluteExpiry,
      msUntilWarning,
    };
  }
  if (msUntilIdleExpiry <= 0) {
    return {
      state: "expired",
      reason: "inactivity",
      msUntilIdleExpiry,
      msUntilAbsoluteExpiry,
      msUntilWarning,
    };
  }
  if (idleMs >= policy.warningMs) {
    return { state: "warning", msUntilIdleExpiry, msUntilAbsoluteExpiry, msUntilWarning };
  }
  return { state: "active", msUntilIdleExpiry, msUntilAbsoluteExpiry, msUntilWarning };
}

/**
 * Server-side guard: true when the absolute lifetime has elapsed. Unknown
 * sign-in times are never treated as expired here, because the client guard
 * still applies the browser-tracked cap.
 */
export function isAbsoluteSessionExpired(input: {
  nowMs: number;
  sessionStartedMs: number | null;
  policy?: PlatformSessionPolicy;
}): boolean {
  if (input.sessionStartedMs === null) return false;
  const policy = input.policy ?? PLATFORM_SESSION_POLICY;
  return input.nowMs - input.sessionStartedMs >= policy.absoluteMs;
}

/** localStorage key for the most recent activity, isolated per platform session. */export function platformSessionActivityKey(sessionId: string): string {
  return `${ACTIVITY_KEY_PREFIX}${sessionId}`;
}

/**
 * localStorage key for the first observed sign-in time. Used only when the
 * server cannot supply the authentication time, so the 12-hour cap still
 * survives reloads instead of restarting on every page load.
 */
export function platformSessionStartedKey(sessionId: string): string {
  return `${STARTED_KEY_PREFIX}${sessionId}`;
}

/** Parse a persisted epoch-milliseconds value; anything unusable is absent. */
export function parseStoredTimestamp(raw: string | null): number | null {
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Most recent of the candidate timestamps, or null when none is usable. */
export function latestTimestamp(
  candidates: ReadonlyArray<number | null | undefined>,
): number | null {
  let latest: number | null = null;
  for (const candidate of candidates) {
    if (typeof candidate !== "number" || !Number.isFinite(candidate) || candidate <= 0) continue;
    if (latest === null || candidate > latest) latest = candidate;
  }
  return latest;
}

/** Whole minutes to show in the warning copy; never reports "0 minutes". */
export function remainingMinutesLabel(msUntilExpiry: number): number {
  return Math.max(1, Math.ceil(msUntilExpiry / 60_000));
}
