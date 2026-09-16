import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformAccess } from "@/app/components/PlatformAccess";

export default async function PlatformAccessPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformAccess />
    </QueryErrorBoundary>
  );
}