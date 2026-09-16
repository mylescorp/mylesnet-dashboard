import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformRadiusFleet } from "@/app/components/PlatformRadiusFleet";

export default async function PlatformRadiusFleetPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformRadiusFleet />
    </QueryErrorBoundary>
  );
}
