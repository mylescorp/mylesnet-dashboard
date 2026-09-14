import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformOverview } from "@/app/components/PlatformOverview";

export default async function PlatformOverviewPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformOverview />
    </QueryErrorBoundary>
  );
}