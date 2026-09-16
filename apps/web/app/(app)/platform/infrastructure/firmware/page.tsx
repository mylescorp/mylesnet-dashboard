import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformFirmwareRollout } from "@/app/components/PlatformFirmwareRollout";

export default async function PlatformFirmwareRolloutPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformFirmwareRollout />
    </QueryErrorBoundary>
  );
}