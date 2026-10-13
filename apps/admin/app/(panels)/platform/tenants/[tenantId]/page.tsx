import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformTenantDetail } from "@/platform/components/PlatformTenantDetail";

export default async function PlatformTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/organizations");
  const { tenantId } = await params;
  return (
    <QueryErrorBoundary>
      <PlatformTenantDetail tenantId={tenantId} />
    </QueryErrorBoundary>
  );
}
