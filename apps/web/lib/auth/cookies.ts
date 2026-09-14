/**
 * Cookie policy for the MylesNet web app.
 *
 * Implements the Cookie Handling standard: cookie names are `__mylesnet_*`,
 * every cookie sets httpOnly+secure+sameSite+path+maxAge, clears are done by
 * writing an empty value with maxAge 0 / expires epoch (never `delete()` alone),
 * and CSRF tokens remain HttpOnly. Auth cookies are deliberately host-only:
 * a panel or tenant session must not become a credential for a sibling host.
 * The authenticated CSRF endpoint returns a
 * token in its response body for the caller to echo in a request header; it
 * never exposes the cookie to client-side JavaScript.
 */

const PRODUCT_PREFIX = "mylesnet";

export const TENANT_COOKIE_NAME = `__${PRODUCT_PREFIX}_tenant`;
export const CSRF_COOKIE_NAME = `__${PRODUCT_PREFIX}_csrf`;

export const TENANT_COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days (session-bound)
export const CSRF_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

export interface MylesnetCookieOptions {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax" | "strict";
  path: string;
  maxAge: number;
  domain: string | undefined;
  expires?: Date;
}

/**
 * Base options every MylesNet cookie must carry. `secure` stays true even in
 * development per the Cookie Handling standard. Domain defaults to the
 * No domain attribute is emitted. Do not broaden this to the product apex:
 * host-only cookies are required for panel and tenant isolation.
 */
export function baseCookieOptions(
  overrides: Partial<MylesnetCookieOptions> = {},
): MylesnetCookieOptions {
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: TENANT_COOKIE_MAX_AGE,
    domain: undefined,
    ...overrides,
  };
}

/**
 * CSRF cookie options. The token cookie is HttpOnly as required by the vault
 * standard. Clients obtain the matching token only from the authenticated
 * `/api/auth/csrf` response body, then send it in `X-CSRF-Token`.
 */
export function csrfCookieOptions(): MylesnetCookieOptions {
  return baseCookieOptions({ httpOnly: true, maxAge: CSRF_COOKIE_MAX_AGE });
}

/**
 * Options for clearing a cookie. Clearing sets an empty value with maxAge 0
 * and expires epoch instead of calling `response.cookies.delete()` alone.
 */
export function clearCookieOptions(base: MylesnetCookieOptions): MylesnetCookieOptions {
  return {
    ...base,
    httpOnly: base.httpOnly,
    maxAge: 0,
    expires: new Date(0),
  };
}
