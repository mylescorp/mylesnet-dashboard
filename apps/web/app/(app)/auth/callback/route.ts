import { handleAuth } from "@workos-inc/authkit-nextjs";
import { NextResponse, type NextRequest } from "next/server";

const callback = handleAuth({
  onError: async ({ error, request }) => {
    const code = typeof error === "object" && error !== null && "code" in error
      ? (error as { code?: unknown }).code
      : undefined;
    const sessionCookieName = process.env.WORKOS_COOKIE_NAME ?? "wos-session";

    // AuthKit consumes the PKCE verifier after a successful callback. Some
    // browsers replay the callback URL shortly afterwards; if the session was
    // already saved, treat that replay as completed sign-in rather than
    // replacing the dashboard with a 500 missing_pkce_cookie error.
    if (code === "missing_pkce_cookie" && request.cookies.get(sessionCookieName)?.value) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return NextResponse.redirect(new URL("/signin?error=sign_in_session", request.url));
  },
});

export async function GET(request: NextRequest) {
  return callback(request);
}
