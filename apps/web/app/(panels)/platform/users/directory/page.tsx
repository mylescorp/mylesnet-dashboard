import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformUserDirectory } from "@/platform/components/PlatformUserDirectory";

export default async function PlatformUserDirectoryPage() {
  await requirePanelAccess("platform");
  return <QueryErrorBoundary><PlatformUserDirectory /></QueryErrorBoundary>;
}
