import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformFeatureFlagDetail } from "@/platform/components/PlatformFeatureFlagDetail";

export default async function PlatformFeatureFlagPage({
  params,
}: {
  params: Promise<{ flag: string }>;
}) {
  await requirePanelAccess("platform");
  const { flag } = await params;
  return (
    <QueryErrorBoundary>
      <PlatformFeatureFlagDetail flag={flag} />
    </QueryErrorBoundary>
  );
}
