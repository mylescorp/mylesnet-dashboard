import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformTenantControl } from "@/platform/components/PlatformTenantControl";

export default async function PlatformTenantsPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/organizations");
  return (
    <QueryErrorBoundary>
      <PlatformTenantControl />
    </QueryErrorBoundary>
  );
}
