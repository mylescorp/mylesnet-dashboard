import { authkitMiddleware } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { TENANT_COOKIE_NAME, TENANT_COOKIE_MAX_AGE, baseCookieOptions } from "@/lib/auth/cookies";
import { callbackUriForHost, resolveMylesnetHost } from "@/lib/auth/tenant";
import { PUBLIC_PATHS } from "@/lib/public-routes";

function authProxyForCallback(redirectUri: string) {
  return authkitMiddleware({
    redirectUri,
    middlewareAuth: { enabled: true, unauthenticatedPaths: PUBLIC_PATHS },
  });
}

/** Opaque, additive security headers (Security Standards; CSP deferred). */
function applySecurityHeaders(response: NextResponse): void {
  response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self)",
  );
}

/** Set the tenant cookie from the request hostname (Cookie Handling). */
function applyTenantCookie(request: NextRequest, response: NextResponse): void {
  const host = resolveMylesnetHost(
    request.nextUrl.hostname,
    process.env.MYLESNET_PUBLIC_DOMAIN,
  );
  if (host.kind !== "tenant") return;
  const slug = host.tenantSlug;
  if (request.cookies.get(TENANT_COOKIE_NAME)?.value === slug) return;
  response.cookies.set(
    TENANT_COOKIE_NAME,
    slug,
    baseCookieOptions({ httpOnly: true, maxAge: TENANT_COOKIE_MAX_AGE }),
  );
}

export default async function proxy(request: NextRequest, event: NextFetchEvent) {
  // Normalize trailing slashes before auth matching: the middleware auth path
  // list is exact-match, so "/features/" would otherwise hit the sign-in
  // redirect instead of the 308 to "/features" (trailingSlash: false).
  const { pathname } = request.nextUrl;
  if (pathname.length > 1 && pathname.endsWith("/")) {
    const url = request.nextUrl.clone();
    url.pathname = pathname.replace(/\/+$/, "") || "/";
    return NextResponse.redirect(url, 308);
  }
  const password = process.env.WORKOS_COOKIE_PASSWORD;
  if (!password || password.length < 32) {
    return new NextResponse("Service configuration is incomplete.", { status: 503 });
  }
  const host = resolveMylesnetHost(request.nextUrl.host, process.env.MYLESNET_PUBLIC_DOMAIN);
  const redirectUri = callbackUriForHost(host, request.nextUrl.protocol);
  if (!redirectUri) return new NextResponse("Unknown MylesNet host.", { status: 421 });
  try {
    const response = await authProxyForCallback(redirectUri)(request, event);
    if (response instanceof NextResponse) {
      applySecurityHeaders(response);
      applyTenantCookie(request, response);
    }
    return response;
  } catch {
    return new NextResponse("Authentication is temporarily unavailable.", { status: 503 });
  }
}

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|xml|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|txt|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
  ],
};
