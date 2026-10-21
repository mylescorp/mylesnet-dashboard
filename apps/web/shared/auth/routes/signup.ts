import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSignUpUrl } from "@workos-inc/authkit-nextjs";
import { appScope } from "@app-scope";
import { resolveMylesnetRequest } from "@/lib/auth/tenant";

/** Starts the hosted AuthKit sign-up flow from an approved MylesNet host. */
export async function GET() {
  const requestHeaders = await headers();
  const { redirectUri } = resolveMylesnetRequest(requestHeaders, "", process.env.MYLESNET_PUBLIC_DOMAIN);
  if (!redirectUri) redirect("/?error=unknown_host");
  const authorizationUrl = await getSignUpUrl({ redirectUri, returnTo: appScope.postLoginPath });
  return redirect(authorizationUrl);
}
