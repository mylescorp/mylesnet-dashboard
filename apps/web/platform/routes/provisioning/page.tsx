import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformProvisioning } from "@/platform/components/PlatformProvisioning";

export default async function PlatformProvisioningPage() {
  await requirePanelAccess("platform");
  return <QueryErrorBoundary><PlatformProvisioning /></QueryErrorBoundary>;
}
