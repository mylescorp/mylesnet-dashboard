import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformVoucherMonitor } from "@/platform/components/PlatformVoucherMonitor";

export default async function PlatformVoucherMonitorPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformVoucherMonitor />
    </QueryErrorBoundary>
  );
}
