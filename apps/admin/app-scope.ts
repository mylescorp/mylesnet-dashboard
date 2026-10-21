import type { AppScope } from "@/lib/app-scope-contract";

/**
 * `@app-scope` binding for the platform control plane.
 *
 * This app serves no marketing surface, so only the auth routes it owns are
 * anonymous, and a completed sign-in returns to `/platform` instead of
 * `/dashboard`, which this app does not serve.
 */
export const appScope: AppScope = {
  publicPaths: [
    "/signin",
    "/login",
    "/auth/callback",
    "/password-reset",
    "/invite",
    "/no-access",
  ],
  postLoginPath: "/platform",
};
