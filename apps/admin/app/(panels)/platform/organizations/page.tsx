import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformOrganizationList } from "@/platform/components/PlatformOrganizationList";

export default async function PlatformOrganizationsPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/organizations");
  return (
    <QueryErrorBoundary>
      <PlatformOrganizationList />
    </QueryErrorBoundary>
  );
}