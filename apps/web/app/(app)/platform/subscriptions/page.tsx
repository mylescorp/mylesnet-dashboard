import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformSubscriptions } from "@/app/components/PlatformSubscriptions";

export default async function PlatformSubscriptionsPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformSubscriptions />
    </QueryErrorBoundary>
  );
}