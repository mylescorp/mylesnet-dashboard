/**
 * Platform session guard (client).
 *
 * Applies the approved platform session policy: a warning at 25 minutes of
 * inactivity, sign-out at 30 minutes, and a hard 12-hour cap measured from the
 * original sign-in time. Activity is shared across tabs through localStorage,
 * keyed by the platform session, so an idle background tab is not signed out
 * while another tab is in use.
 *
 * Two rules keep the timeout honest:
 *  - loading the page never revives a session that already expired while the
 *     browser was closed;
 *   - an interaction that arrives after a long absence ends the session before
 *     it can be counted as activity.
 *
 * The policy and its values live in `@/lib/auth/sessionPolicy` (the single
 * approved source); this component only applies them and renders safe copy.
 * The server-side half of the policy lives in the platform layout.
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
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
  const seededRef = useRef(false);
  const signingOutRef = useRef(false);
  const tickRef = useRef<() => void>(() => {});
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const readStoredActivity = useCallback((): number | null => {
    if (!sessionId) return null;
    try {
      return parseStoredTimestamp(
        window.localStorage.getItem(platformSessionActivityKey(sessionId)),
      );
    } catch {
      return null;
    }
  }, [sessionId]);

  const evaluate = useCallback(
    (nowMs: number, lastActivityMs: number): PlatformSessionSnapshot =>
      evaluatePlatformSession({
        nowMs,
        lastActivityMs,
        sessionStartedMs: startedAtRef.current,
        policy,
      }),
    [policy],
  );

  const recordActivity = useCallback(
    (force = false) => {
      const at = Date.now();
      const lastActivityMs =
        latestTimestamp([lastActivityRef.current, readStoredActivity()]) ??
        lastActivityRef.current;
      // A tab that was left idle (or a returning tab) must never extend a
      // session that has already expired: end it instead of touching the clock.
      if (seededRef.current && evaluate(at, lastActivityMs).state === "expired") {
        tickRef.current();
        return;
      }
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
    [evaluate, readStoredActivity, sessionId],
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

  // Seed the clocks once the platform session is known. A page load only
  // counts as activity when the stored activity is still inside the policy
  // window; a stale stored value is left in place so the poll tick ends the
  // session. The stored sign-in time is consulted only when the server could
  // not supply one.
  useEffect(() => {
    if (!sessionId) return;
    const at = Date.now();
    let startedAt: number = sessionStartedAtMs ?? at;
    let lastActivityMs = at;
    try {
      if (sessionStartedAtMs === null) {
        const startedKey = platformSessionStartedKey(sessionId);
        const storedStarted = parseStoredTimestamp(window.localStorage.getItem(startedKey));
        startedAt = storedStarted ?? at;
        if (storedStarted === null) window.localStorage.setItem(startedKey, String(at));
      }
      lastActivityMs = readStoredActivity() ?? at;
    } catch {
      // Keep the in-memory values above when storage is blocked.
    }
    startedAtRef.current = startedAt;
    const stored = evaluate(at, lastActivityMs);
    if (stored.state === "expired") {
      lastActivityRef.current = lastActivityMs;
      persistedActivityRef.current = lastActivityMs;
    } else {
      lastActivityRef.current = at;
      persistedActivityRef.current = at;
      try {
        window.localStorage.setItem(platformSessionActivityKey(sessionId), String(at));
      } catch {
        // Storage can be blocked: the in-memory clock still applies.
      }
    }
    seededRef.current = true;
  }, [evaluate, readStoredActivity, sessionId, sessionStartedAtMs]);

  // Poll the policy and end the session when it expires.
  useEffect(() => {
    if (!sessionId) return;
    let cancelled = false;

    const expire = () => {
      if (cancelled || signingOutRef.current) return;
      signingOutRef.current = true;
      const returnTo = `${window.location.origin}/signin`;
      const failed = () => {
        if (cancelled) return;
        // Let the next check try again; the notice also links to /sign-out.
        signingOutRef.current = false;
        setSignOutFailed(true);
      };
      try {
        Promise.resolve(signOut({ returnTo })).catch(failed);
      } catch {
        failed();
      }
    };

    const tick = () => {
      if (cancelled) return;
      const lastActivityMs =
        latestTimestamp([lastActivityRef.current, readStoredActivity()]) ??
        lastActivityRef.current;
      const next = evaluate(Date.now(), lastActivityMs);
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
  }, [evaluate, pollIntervalMs, readStoredActivity, sessionId, signOut]);

  const staySignedIn = useCallback(() => {
    recordActivity(true);
    tickRef.current();
  }, [recordActivity]);

  // While the expiry notice is open, the page underneath is hidden from
  // assistive technology and made inert, and keyboard focus stays in the
  // notice. The notice is portalled so it is not part of what gets isolated.
  const expired = snapshot?.state === "expired";
  useEffect(() => {
    if (!expired) return;
    const overlay = overlayRef.current;
    if (!overlay) return;
    const isolated: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (!(child instanceof HTMLElement) || child === overlay || child.contains(overlay)) continue;
      isolated.push(child);
      child.setAttribute("aria-hidden", "true");
      child.setAttribute("inert", "");
    }
    return () => {
      for (const child of isolated) {
        child.removeAttribute("aria-hidden");
        child.removeAttribute("inert");
      }
    };
  }, [expired]);

  useEffect(() => {
    if (!expired) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = () =>
      Array.from(dialog.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
    focusable()[0]?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const current = items.indexOf(document.activeElement as HTMLElement);
      const next = event.shiftKey
        ? current <= 0
          ? items.length - 1
          : current - 1
        : current === -1 || current === items.length - 1
          ? 0
          : current + 1;
      event.preventDefault();
      items[next]?.focus();
    };
    dialog.addEventListener("keydown", onKeyDown);
    return () => dialog.removeEventListener("keydown", onKeyDown);
  }, [expired]);

  if (!snapshot) return null;

  if (snapshot.state === "expired") {
    if (typeof document === "undefined") return null;
    return createPortal(
      <div className="platform-session-overlay" ref={overlayRef}>
        <div
          className="platform-session-dialog"
          ref={dialogRef}
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
          <a className="platform-session-action" href="/sign-out">
            Sign in again
          </a>
        </div>
      </div>,
      document.body,
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
            minute{minutes === 1 ? "" : "s"} left.
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
