import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformProvisioning } from "@/app/components/PlatformProvisioning";

export default async function PlatformProvisioningPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformProvisioning />
    </QueryErrorBoundary>
  );
}