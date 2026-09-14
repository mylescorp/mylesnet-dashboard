import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformSecurity } from "@/app/components/PlatformSecurity";

export default async function PlatformSecurityPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformSecurity />
    </QueryErrorBoundary>
  );
}