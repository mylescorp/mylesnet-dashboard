import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { signOut, withAuth } from "@workos-inc/authkit-nextjs";
import { resolveMylesnetRequest } from "@/lib/auth/tenant";

/**
 * Ends a platform session whose server-enforced lifetime has elapsed.
 *
 * The platform layout redirects here instead of rendering when the absolute
 * 12-hour cap is exceeded. The post-sign-out target is derived from the same
 * host allow-list as the auth callback, so an unknown host cannot be used to
 * choose a redirect target. No session means nothing to end: the visitor is
 * sent straight back to sign in.
 */
export async function GET(request: NextRequest) {
  const routing = resolveMylesnetRequest(
    request.headers,
    request.nextUrl.host,
    process.env.MYLESNET_PUBLIC_DOMAIN,
    request.nextUrl.protocol,
  );
  const origin = routing.redirectUri
    ? new URL(routing.redirectUri).origin
    : request.nextUrl.origin;
  const returnTo = `${origin}/signin`;

  const { user } = await withAuth();
  if (!user) redirect(returnTo);

  await signOut({ returnTo });
}
