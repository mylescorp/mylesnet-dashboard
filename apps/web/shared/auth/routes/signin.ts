import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { appScope } from "@app-scope";
import { resolveMylesnetRequest } from "@/lib/auth/tenant";

export async function GET() {
  const requestHeaders = await headers();
  const { redirectUri } = resolveMylesnetRequest(requestHeaders, "", process.env.MYLESNET_PUBLIC_DOMAIN);
  if (!redirectUri) redirect("/?error=unknown_host");
  const authorizationUrl = await getSignInUrl({ redirectUri, returnTo: appScope.postLoginPath });
  return redirect(authorizationUrl);
}
