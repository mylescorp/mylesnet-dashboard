import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformTenantControl } from "@/app/components/PlatformTenantControl";

export default async function PlatformTenantsPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformTenantControl />
    </QueryErrorBoundary>
  );
}