import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformHealthOverview } from "@/app/components/PlatformHealthOverview";

export default async function PlatformHealthPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformHealthOverview />
    </QueryErrorBoundary>
  );
}