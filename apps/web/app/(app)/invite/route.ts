import { NextResponse, type NextRequest } from "next/server";
import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { callbackUriForHost, resolveMylesnetHost } from "@/lib/auth/tenant";

function safeToken(value: string | null): string | null {
  return value && /^[A-Za-z0-9_-]{16,2048}$/.test(value) ? value : null;
}

/**
 * WorkOS sends the invitation token here. Start a normal AuthKit PKCE sign-up
 * flow, then forward the token only to WorkOS. It is never logged, persisted,
 * or rendered by MylesNet.
 */
export async function GET(request: NextRequest) {
  const invitationToken = safeToken(request.nextUrl.searchParams.get("invitation_token"));
  const host = resolveMylesnetHost(request.nextUrl.host, process.env.MYLESNET_PUBLIC_DOMAIN);
  const redirectUri = callbackUriForHost(host, request.nextUrl.protocol);
  if (!invitationToken || !redirectUri) return NextResponse.redirect(new URL("/signin?error=invalid_invitation", request.url));
  const authorizationUrl = new URL(await getSignUpUrl({ redirectUri, returnTo: "/dashboard" }));
  authorizationUrl.searchParams.set("invitation_token", invitationToken);
  const response = NextResponse.redirect(authorizationUrl);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
