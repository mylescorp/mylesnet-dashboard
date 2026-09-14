import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformDeviceFleet } from "@/app/components/PlatformDeviceFleet";

export default async function PlatformDeviceFleetPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformDeviceFleet />
    </QueryErrorBoundary>
  );
}