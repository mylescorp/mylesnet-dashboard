import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformOverview } from "@/platform/components/PlatformOverview";

export default async function PlatformOverviewPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformOverview />
    </QueryErrorBoundary>
  );
}
