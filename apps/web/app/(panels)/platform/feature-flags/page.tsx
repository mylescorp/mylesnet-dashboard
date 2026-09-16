import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformFeatureFlags } from "@/app/components/PlatformFeatureFlags";

export default async function PlatformFeatureFlagsPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformFeatureFlags />
    </QueryErrorBoundary>
  );
}