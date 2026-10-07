import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSla } from "@/platform/components/PlatformSla";

export default async function PlatformSlaPage() {
  await requirePanelAccess("platform");
  return <QueryErrorBoundary><PlatformSla /></QueryErrorBoundary>;
}
