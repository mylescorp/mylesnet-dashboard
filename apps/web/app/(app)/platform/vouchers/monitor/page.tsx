import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformVoucherMonitor } from "@/app/components/PlatformVoucherMonitor";

export default async function PlatformVoucherMonitorPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformVoucherMonitor />
    </QueryErrorBoundary>
  );
}