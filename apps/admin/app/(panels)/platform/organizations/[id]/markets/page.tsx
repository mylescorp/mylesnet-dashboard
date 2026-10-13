import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformMarkets } from "@/platform/components/PlatformMarkets";
import type { Id } from "@/convex/_generated/dataModel";

export default async function PlatformOrganizationMarketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/organizations");
  const { id } = await params;
  return (
    <QueryErrorBoundary>
      <PlatformMarkets tenantId={id as Id<"tenants">} />
    </QueryErrorBoundary>
  );
}
