import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformMarkets } from "@/platform/components/PlatformMarkets";
import type { Id } from "@/convex/_generated/dataModel";

export default async function PlatformOrganizationMarketsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformMarkets tenantId={id as Id<"tenants">} />
    </QueryErrorBoundary>
  );
}
