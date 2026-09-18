import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformMarkets } from "@/platform/components/PlatformMarkets";

export default async function PlatformOrganizationMarketsPage({
  params,
}: {
  params: { id: string };
}) {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformMarkets tenantId={params.id as any} />
    </QueryErrorBoundary>
  );
}