import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSubscriptions } from "@/platform/components/PlatformSubscriptions";

export default async function PlatformSubscriptionsPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/subscriptions");
  return (
    <QueryErrorBoundary>
      <PlatformSubscriptions />
    </QueryErrorBoundary>
  );
}
