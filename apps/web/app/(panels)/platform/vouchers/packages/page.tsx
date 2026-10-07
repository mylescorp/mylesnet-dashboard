import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformVoucherPackages } from "@/platform/components/PlatformVoucherPackages";

export default async function PlatformVoucherPackagesPage() {
  await requirePanelAccess("platform");
  return <QueryErrorBoundary><PlatformVoucherPackages /></QueryErrorBoundary>;
}
