import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformTenantControl } from "@/platform/components/PlatformTenantControl";

export default async function PlatformOrganizationsPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformTenantControl />
    </QueryErrorBoundary>
  );
}
