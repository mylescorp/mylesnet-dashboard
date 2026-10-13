import { requirePanelAccess } from "@/lib/auth/panels";
import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSystemHealth } from "@/platform/components/PlatformSystemHealth";

export default async function PlatformSystemHealthPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/health");
  return <QueryErrorBoundary><PlatformSystemHealth /></QueryErrorBoundary>;
}
