import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSubscriptions } from "@/platform/components/PlatformSubscriptions";

export default async function PlatformSubscriptionsPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformSubscriptions />
    </QueryErrorBoundary>
  );
}
