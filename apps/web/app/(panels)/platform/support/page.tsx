import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSupportQueue } from "@/platform/components/PlatformSupportQueue";

export default async function PlatformSupportPage() {
  await requirePanelAccess("platform");
  return <QueryErrorBoundary><PlatformSupportQueue /></QueryErrorBoundary>;
}
