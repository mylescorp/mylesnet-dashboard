import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import AccessManagementPage from "@/dashboard/routes/access/page";

export default async function PlatformAccessPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/access");
  return (
    <QueryErrorBoundary>
      <AccessManagementPage />
    </QueryErrorBoundary>
  );
}
