import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import SettingsPage from "@/dashboard/routes/settings/page";

export default async function PlatformSettingsPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <SettingsPage />
    </QueryErrorBoundary>
  );
}
