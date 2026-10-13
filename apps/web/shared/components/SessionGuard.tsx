/**
 * Platform session guard (client).
 *
 * Applies the approved platform session policy: a warning at 25 minutes of
 * inactivity, sign-out at 30 minutes, and a hard 12-hour cap measured from the
 * original sign-in time. Activity is shared across tabs through localStorage,
 * keyed by the platform session, so an idle background tab is not signed out
 * while another tab is in use.
 *
 * The policy and its values live in `@/lib/auth/sessionPolicy` (the single
 * approved source); this component only applies them and renders safe copy.
 * The server-side half of the policy lives in the platform layout.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@workos-inc/authkit-nextjs/components";
import {
  PLATFORM_SESSION_POLICY,
  evaluatePlatformSession,
  latestTimestamp,
  parseStoredTimestamp,
  platformSessionActivityKey,
  platformSessionStartedKey,
  remainingMinutesLabel,
  type PlatformSessionPolicy,
  type PlatformSessionSnapshot,
} from "@/lib/auth/sessionPolicy";

const ACTIVITY_PERSIST_INTERVAL_MS = 30_000;
const DEFAULT_POLL_INTERVAL_MS = 15_000;

const ACTIVITY_EVENTS = [
  "pointerdown",
  "pointermove",
  "keydown",
  "scroll",
  "touchstart",
  "focus",
] as const;

export interface SessionGuardProps {
  /** The original sign-in time supplied by the server, or null when unknown. */
  sessionStartedAtMs: number | null;
  /** Approved policy. Overridable only so tests can use short durations. */
  policy?: PlatformSessionPolicy;
  /** How often the guard re-checks the policy. */
  pollIntervalMs?: number;
}

export function SessionGuard({
  sessionStartedAtMs,
  policy = PLATFORM_SESSION_POLICY,
  pollIntervalMs = DEFAULT_POLL_INTERVAL_MS,
}: SessionGuardProps) {
  const { sessionId, signOut } = useAuth();
  const [snapshot, setSnapshot] = useState<PlatformSessionSnapshot | null>(null);
  const [signOutFailed, setSignOutFailed] = useState(false);

  const lastActivityRef = useRef(0);
  const persistedActivityRef = useRef(0);
  const startedAtRef = useRef<number | null>(null);
  const signingOutRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});

  const recordActivity = useCallback(
    (force = false) => {
      const at = Date.now();
      lastActivityRef.current = at;
      if (!sessionId) return;
      if (!force && at - persistedActivityRef.current < ACTIVITY_PERSIST_INTERVAL_MS) return;
      persistedActivityRef.current = at;
      try {
        window.localStorage.setItem(platformSessionActivityKey(sessionId), String(at));
      } catch {
        // Storage can be blocked: the in-memory clock still applies.
      }
    },
    [sessionId],
  );

  // Any interaction in any tab counts as activity; tab focus does too.
  useEffect(() => {
    const onActivity = () => recordActivity();
    const onVisibility = () => {
      if (document.visibilityState === "visible") recordActivity();
    };
    for (const event of ACTIVITY_EVENTS) {
      window.addEventListener(event, onActivity, { passive: true });
    }
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      for (const event of ACTIVITY_EVENTS) {
        window.removeEventListener(event, onActivity);
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [recordActivity]);

  // Seed the clocks once the platform session is known. The stored sign-in
  // time is consulted only when the server could not supply one.
  useEffect(() => {
    if (!sessionId) return;
    const at = Date.now();
    lastActivityRef.current = at;
    persistedActivityRef.current = at;
    let startedAt: number = sessionStartedAtMs ?? at;
    try {
      const activityKey = platformSessionActivityKey(sessionId);
      const storedActivity = parseStoredTimestamp(window.localStorage.getItem(activityKey));
      lastActivityRef.current = latestTimestamp([at, storedActivity]) ?? at;
      if (sessionStartedAtMs === null) {
        const startedKey = platformSessionStartedKey(sessionId);
        const storedStarted = parseStoredTimestamp(window.localStorage.getItem(startedKey));
        startedAt = storedStarted ?? at;
        if (storedStarted === null) window.localStorage.setItem(startedKey, String(at));
      }
      window.localStorage.setItem(activityKey, String(at));
    } catch {
      // Keep the in-memory start time above.
    }
    startedAtRef.current = startedAt;
  }, [sessionId, sessionStartedAtMs]);

  // Poll the policy and end the session when it expires.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const expire = () => {
      if (cancelled || signingOutRef.current) return;
      signingOutRef.current = true;
      const returnTo = `${window.location.origin}/signin`;
      try {
        Promise.resolve(signOut({ returnTo })).catch(() => {
          if (!cancelled) setSignOutFailed(true);
        });
      } catch {
        if (!cancelled) setSignOutFailed(true);
      }
    };

    const tick = () => {
      if (cancelled) return;
      let storedActivity: number | null = null;
      try {
        storedActivity = parseStoredTimestamp(
          window.localStorage.getItem(platformSessionActivityKey(sessionId)),
        );
      } catch {
        // Storage can be blocked: fall back to the in-memory clock.
      }
      const lastActivityMs =
        latestTimestamp([lastActivityRef.current, storedActivity]) ?? lastActivityRef.current;
      const next = evaluatePlatformSession({
        nowMs: Date.now(),
        lastActivityMs,
        sessionStartedMs: startedAtRef.current,
        policy,
      });
      setSnapshot((current) =>
        current !== null &&
        current.state === next.state &&
        current.reason === next.reason &&
        remainingMinutesLabel(current.msUntilIdleExpiry) ===
          remainingMinutesLabel(next.msUntilIdleExpiry)
          ? current
          : next,
      );
      if (next.state === "expired") expire();
    };

    tickRef.current = tick;
    tick();
    const timer = window.setInterval(tick, pollIntervalMs);
    return () => {
      cancelled = true;
      tickRef.current = () => {};
      window.clearInterval(timer);
    };
  }, [sessionId, signOut, policy, pollIntervalMs]);

  const staySignedIn = useCallback(() => {
    recordActivity(true);
    tickRef.current();
  }, [recordActivity]);

  if (!snapshot) return null;

  if (snapshot.state === "expired") {
    return (
      <div className="platform-session-overlay">
        <div
          className="platform-session-dialog"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="platform-session-expired-title"
        >
          <h2 id="platform-session-expired-title" className="platform-session-title">
            Your session has ended
          </h2>
          <p className="platform-session-detail">
            {snapshot.reason === "absolute"
              ? "For your security, sign in again after the maximum session length."
              : "For your security, sign in again after a period of inactivity."}
          </p>
          {signOutFailed ? (
            <p className="platform-session-detail">
              We could not end this session automatically. Sign in again to continue.
            </p>
          ) : null}
          <a className="platform-session-action" href="/signin">
            Sign in again
          </a>
        </div>
      </div>
    );
  }

  if (snapshot.state === "warning") {
    const minutes = remainingMinutesLabel(snapshot.msUntilIdleExpiry);
    return (
      <div className="platform-session-banner" role="alert">
        <div className="platform-session-copy">
          <strong>Still working?</strong>
          <span>
            {" "}
            For your security, this session ends after 30 minutes of inactivity. About {minutes}{" "}
            {minutes === 1 ? "minute" : "minutes"} left.
          </span>
        </div>
        <button type="button" className="platform-session-action" onClick={staySignedIn}>
          Stay signed in
        </button>
      </div>
    );
  }

  return null;
}
