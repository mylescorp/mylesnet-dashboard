import { NextRequest, NextResponse } from "next/server";
import {
  CSRF_COOKIE_NAME,
  clearCookieOptions,
  csrfCookieOptions,
} from "@/lib/auth/cookies";
import {
  CSRF_HEADER_NAME,
  generateCsrfToken,
  verifyCsrfToken,
} from "@/lib/auth/csrf";
import { AuthRequiredError, requireUser } from "@/lib/auth/session";

function issueCsrfToken(): NextResponse {
  const token = generateCsrfToken();
  const response = NextResponse.json(
    { csrfToken: token },
    { headers: { "Cache-Control": "no-store" } },
  );
  response.cookies.set(CSRF_COOKIE_NAME, token, csrfCookieOptions());
  return response;
}

function unauthorizedResponse(error: unknown): NextResponse | null {
  if (error instanceof AuthRequiredError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  return null;
}

/** Issue a header token for the authenticated browser session. */
export async function GET(): Promise<NextResponse> {
  try {
    await requireUser();
    return issueCsrfToken();
  } catch (error) {
    return unauthorizedResponse(error) ?? NextResponse.json({ error: "Unable to issue CSRF token." }, { status: 500 });
  }
}

/**
 * Verify then rotate the token. This is a real state-changing endpoint: it
 * replaces the session-bound CSRF cookie only after a valid double-submit
 * exchange, making a successfully used token unusable on the next request.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    await requireUser();
    const cookieToken = request.cookies.get(CSRF_COOKIE_NAME)?.value;
    const headerToken = request.headers.get(CSRF_HEADER_NAME);
    if (!verifyCsrfToken(cookieToken, headerToken)) {
      const response = NextResponse.json({ error: "Invalid CSRF token." }, { status: 403 });
      response.cookies.set(CSRF_COOKIE_NAME, "", clearCookieOptions(csrfCookieOptions()));
      return response;
    }
    return issueCsrfToken();
  } catch (error) {
    return unauthorizedResponse(error) ?? NextResponse.json({ error: "Unable to rotate CSRF token." }, { status: 500 });
  }
}
