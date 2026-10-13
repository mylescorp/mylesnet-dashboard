import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSla } from "@/platform/components/PlatformSla";

export default async function PlatformSlaPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/support/sla");
  return <QueryErrorBoundary><PlatformSla /></QueryErrorBoundary>;
}
