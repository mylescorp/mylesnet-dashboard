import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformTenantDetail } from "@/platform/components/PlatformTenantDetail";

export default async function PlatformTenantDetailPage({
  params,
}: {
  params: Promise<{ tenantId: string }>;
}) {
  await requirePanelAccess("platform");
  const { tenantId } = await params;
  return (
    <QueryErrorBoundary>
      <PlatformTenantDetail tenantId={tenantId} />
    </QueryErrorBoundary>
  );
}
