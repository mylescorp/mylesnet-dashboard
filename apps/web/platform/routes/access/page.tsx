import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformAccess } from "@/platform/components/PlatformAccess";

export default async function PlatformAccessPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformAccess />
    </QueryErrorBoundary>
  );
}
