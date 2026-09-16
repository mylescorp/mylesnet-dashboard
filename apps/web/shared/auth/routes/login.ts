import { NextResponse, type NextRequest } from "next/server";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { callbackUriForHost, resolveMylesnetHost } from "@/lib/auth/tenant";

/**
 * WorkOS' initiate-login endpoint. AuthKit uses this for bookmarked hosted
 * screens and for invitation/password-reset handoffs that did not originate
 * within the application. It starts an AuthKit PKCE flow immediately; it
 * never renders a local credential form.
 */
export async function GET(request: NextRequest) {
  const host = resolveMylesnetHost(request.nextUrl.host, process.env.MYLESNET_PUBLIC_DOMAIN);
  const redirectUri = callbackUriForHost(host, request.nextUrl.protocol);
  if (!redirectUri) return NextResponse.redirect(new URL("/?error=unknown_host", request.url));

  const authorizationUrl = await getSignInUrl({ redirectUri, returnTo: "/dashboard" });
  const response = NextResponse.redirect(authorizationUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
