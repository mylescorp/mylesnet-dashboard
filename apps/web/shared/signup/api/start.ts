import { NextRequest, NextResponse } from "next/server";
import { SIGNUP_COOKIE_NAME, signupCookieOptions } from "@/lib/signup/cookies";
import { generateSignupToken } from "@/lib/signup/token";

/**
 * Mint a sign-up session token and pin it to the browser as an httpOnly
 * cookie. Only triggered from the public wizard when no token exists yet;
 * a cross-site POST is rejected (the wizard is a same-origin flow).
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const origin = request.headers.get("origin");
  const host = request.headers.get("host");
  if (origin && host) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return NextResponse.json({ error: "Unable to start your sign-up." }, { status: 400 });
    }
    if (originHost !== host) {
      return NextResponse.json({ error: "Unable to start your sign-up." }, { status: 403 });
    }
  }
  const token = generateSignupToken();
  const response = NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.set(SIGNUP_COOKIE_NAME, token, signupCookieOptions());
  return response;
}