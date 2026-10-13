import { redirect } from "next/navigation";
import { canSeePlatformNavRoute } from "../navigation/platform-nav-access";
import { requireUser, type AuthSession } from "./session";

/** Apply the sidebar's canonical role matrix before rendering a platform route. */
export async function requirePlatformRouteAccess(route: string): Promise<void> {
  let session: AuthSession;
  try {
    session = await requireUser();
  } catch {
    redirect("/no-access");
  }

  if (!canSeePlatformNavRoute(route, session.roleSlugs)) {
    redirect("/no-access");
  }
}
