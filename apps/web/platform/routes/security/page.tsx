import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformSecurity } from "@/platform/components/PlatformSecurity";

export default async function PlatformSecurityPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformSecurity />
    </QueryErrorBoundary>
  );
}
