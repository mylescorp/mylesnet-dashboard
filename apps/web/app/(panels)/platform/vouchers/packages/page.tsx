import { requirePlatformRouteAccess } from "@/shared/auth/platform-route-access";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformVoucherPackages } from "@/platform/components/PlatformVoucherPackages";

export default async function PlatformVoucherPackagesPage() {
  await requirePanelAccess("platform");
  await requirePlatformRouteAccess("/platform/vouchers/packages");
  return <QueryErrorBoundary><PlatformVoucherPackages /></QueryErrorBoundary>;
}
