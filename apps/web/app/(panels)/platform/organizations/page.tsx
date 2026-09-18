import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformOrganizationList } from "@/platform/components/PlatformOrganizationList";

export default async function PlatformOrganizationsPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformOrganizationList />
    </QueryErrorBoundary>
  );
}