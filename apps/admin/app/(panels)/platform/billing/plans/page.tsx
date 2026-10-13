import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { PlatformPlanCatalog } from "@/platform/components/PlatformPlanCatalog";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";

export default async function PlatformPlansPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/billing/plans");
  return <QueryErrorBoundary><PlatformPlanCatalog /></QueryErrorBoundary>;
}
