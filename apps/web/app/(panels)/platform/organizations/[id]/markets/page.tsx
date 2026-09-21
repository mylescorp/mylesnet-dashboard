import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformMarkets } from "@/platform/components/PlatformMarkets";
import type { Id } from "@/convex/_generated/dataModel";

export default async function PlatformOrganizationMarketsPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformMarkets tenantId={params.id as Id<"tenants">} />
    </QueryErrorBoundary>
  );
}