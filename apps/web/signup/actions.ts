"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { resolveMylesnetRequest } from "@/lib/auth/tenant";
import { SIGNUP_COOKIE_NAME, clearSignupCookieOptions } from "@/lib/signup/cookies";

/** Clear the wizard cookie so a fresh `Start over` gets a new session. */
export async function clearSignupSession(): Promise<void> {
  (await cookies()).set(SIGNUP_COOKIE_NAME, "", clearSignupCookieOptions());
}

/**
 * Hand off a completed sign-up to the sign-in flow: the hosted sign-in page is
 * opened preselected to the brand-new tenant organization with the operator's
 * email pre-filled, and lands back on their dashboard after authentication.
 */
export async function signInAfterSignup(organizationId: string, email: string): Promise<never> {
  const requestHeaders = await headers();
  const { redirectUri } = resolveMylesnetRequest(requestHeaders, "", process.env.MYLESNET_PUBLIC_DOMAIN);
  if (!redirectUri) redirect("/?error=unknown_host");
  const authorizationUrl = await getSignInUrl({
    redirectUri,
    returnTo: "/dashboard",
    organizationId: organizationId || undefined,
    loginHint: email,
  });
  (await cookies()).set(SIGNUP_COOKIE_NAME, "", clearSignupCookieOptions());
  redirect(authorizationUrl);
}
