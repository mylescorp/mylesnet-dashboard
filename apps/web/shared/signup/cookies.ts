/**
 * Public sign-up session cookie policy.
 *
 * The wizard scopes state to the browser with an httpOnly `__mylesnet_signup`
 * cookie carrying an opaque random token; the token is hashed in Convex and
 * never readable from client JavaScript. The cookie is host-only (per the
 * Cookie Handling standard) and lives only on the `/signup` surface.
 */

import { baseCookieOptions, type MylesnetCookieOptions } from "@/lib/auth/cookies";

export const SIGNUP_COOKIE_NAME = "__mylesnet_signup";
export const SIGNUP_COOKIE_MAX_AGE = 60 * 60; // 1 hour (matches the Convex session TTL)

export function signupCookieOptions(): MylesnetCookieOptions {
  return baseCookieOptions({
    httpOnly: true,
    sameSite: "lax",
    path: "/signup",
    maxAge: SIGNUP_COOKIE_MAX_AGE,
  });
}

export function clearSignupCookieOptions(): MylesnetCookieOptions {
  return { ...signupCookieOptions(), maxAge: 0, expires: new Date(0) };
}