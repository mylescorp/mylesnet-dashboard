import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformDeviceFleet } from "@/platform/components/PlatformDeviceFleet";

export default async function PlatformDeviceFleetPage() {
  await requirePanelAccess("platform");
  return <QueryErrorBoundary><PlatformDeviceFleet /></QueryErrorBoundary>;
}
