import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSignInUrl } from "@workos-inc/authkit-nextjs";
import { callbackUriForHost, resolveMylesnetHost } from "@/lib/auth/tenant";

export async function GET() {
  const requestHeaders = await headers();
  const host = resolveMylesnetHost(requestHeaders.get("host"), process.env.MYLESNET_PUBLIC_DOMAIN);
  const redirectUri = callbackUriForHost(host, process.env.NODE_ENV === "production" ? "https:" : "http:");
  if (!redirectUri) redirect("/?error=unknown_host");
  const authorizationUrl = await getSignInUrl({ redirectUri, returnTo: "/dashboard" });
  return redirect(authorizationUrl);
}
