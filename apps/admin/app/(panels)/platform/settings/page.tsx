import { requirePanelAccess } from "@/lib/auth/panels";
import { redirect } from "next/navigation";
import { requireUser } from "@/shared/auth/session";
import { canSeePlatformNavRoute } from "@/shared/navigation/platform-nav-access";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import SettingsPage from "@/dashboard/routes/settings/page";

export default async function PlatformSettingsPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!canSeePlatformNavRoute("/platform/settings", session.roleSlugs)) redirect("/no-access");
  return (
    <QueryErrorBoundary>
      <SettingsPage />
    </QueryErrorBoundary>
  );
}
