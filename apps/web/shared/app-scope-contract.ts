/**
 * Per-deployment routing scope that shared code needs but must not hardcode.
 *
 * `apps/web` and `apps/admin` ship the same `/platform` panel and the same auth
 * routes, but they are different products: one is the website (public marketing
 * surface, `/dashboard` after sign-in), the other is the platform control plane
 * (auth routes and `/platform` only). Each app binds the `@app-scope` alias to
 * its own module (see `tsconfig.json` `paths`) so the shared proxy and auth
 * routes behave per deployment without forking — and, for the mirrored files,
 * without diverging byte-for-byte.
 *
 * This contract carries **routing scope only**. Authorisation stays in the
 * shared role/permission sources; it must never move here.
 */
export type AppScope = {
  /** Anonymous paths the auth proxy must not redirect into sign-in. */
  publicPaths: string[];
  /** Where a completed sign-in/up returns, and where session replays land. */
  postLoginPath: string;
};
