import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { requireUser } from "@/shared/auth/session";
import { canSeePlatformNavRoute } from "@/shared/navigation/platform-nav-access";
import { PlatformPartnerRegistry } from "@/platform/components/PlatformPartnerRegistry";

export default async function PlatformResellersPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!canSeePlatformNavRoute("/platform/resellers", session.roleSlugs)) redirect("/no-access");
  return <PlatformPartnerRegistry type="reseller" />;
}
