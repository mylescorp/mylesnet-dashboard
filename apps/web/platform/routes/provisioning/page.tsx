import { requirePanelAccess } from "@/lib/auth/panels";
import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformProvisioning } from "@/platform/components/PlatformProvisioning";

export default async function PlatformProvisioningPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/infrastructure/provisioning-queue");
  return <QueryErrorBoundary><PlatformProvisioning /></QueryErrorBoundary>;
}
