import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformFeatureFlags } from "@/platform/components/PlatformFeatureFlags";

export default async function PlatformFeatureFlagsPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformFeatureFlags />
    </QueryErrorBoundary>
  );
}
