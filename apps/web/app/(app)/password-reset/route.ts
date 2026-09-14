import { NextResponse, type NextRequest } from "next/server";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { callbackUriForHost, resolveMylesnetHost } from "@/lib/auth/tenant";

function safeToken(value: string | null): string | null {
  return value && /^[A-Za-z0-9_-]{16,2048}$/.test(value) ? value : null;
}

/**
 * WorkOS password-reset handoff. AuthKit retains token validation and password
 * policy enforcement; MylesNet only transfers a validated token into its PKCE
 * flow and never stores or exposes it.
 */
export async function GET(request: NextRequest) {
  const passwordResetToken = safeToken(request.nextUrl.searchParams.get("token"));
  const host = resolveMylesnetHost(request.nextUrl.host, process.env.MYLESNET_PUBLIC_DOMAIN);
  const redirectUri = callbackUriForHost(host, request.nextUrl.protocol);
  if (!passwordResetToken || !redirectUri) return NextResponse.redirect(new URL("/signin?error=invalid_password_reset", request.url));
  const authorizationUrl = new URL(await getSignInUrl({ redirectUri, returnTo: "/dashboard" }));
  authorizationUrl.searchParams.set("password_reset_token", passwordResetToken);
  const response = NextResponse.redirect(authorizationUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
