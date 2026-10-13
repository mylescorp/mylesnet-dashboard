import { redirect } from "next/navigation";
import { isAbsoluteSessionExpired } from "./sessionPolicy";
import type { AuthSession } from "./session";

/**
 * Server-side half of the platform session policy.
 *
 * The absolute 12-hour cap is enforced before any platform markup renders, so
 * an expired session cannot be used even without client JavaScript. The idle
 * timeout and the 25-minute warning are applied by the browser guard; an
 * unknown sign-in time is left to that guard rather than guessing.
 */

/** The original sign-in time from the session, or null when not present. */
export function platformSessionStartedAtMs(session: AuthSession): number | null {
  return session.authenticatedAt?.getTime() ?? null;
}

/** Redirect to sign-out when the absolute platform session lifetime has elapsed. */
export function assertPlatformSessionLifetime(sessionStartedAtMs: number | null): void {
  if (isAbsoluteSessionExpired({ nowMs: Date.now(), sessionStartedMs: sessionStartedAtMs })) {
    redirect("/sign-out");
  }
}
