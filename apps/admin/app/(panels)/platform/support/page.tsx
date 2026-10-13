import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSupportQueue } from "@/platform/components/PlatformSupportQueue";

export default async function PlatformSupportPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/support");
  return <QueryErrorBoundary><PlatformSupportQueue /></QueryErrorBoundary>;
}
