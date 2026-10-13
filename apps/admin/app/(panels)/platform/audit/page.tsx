import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformAuditLog } from "@/platform/components/PlatformAuditLog";

export default async function PlatformAuditPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformAuditLog />
    </QueryErrorBoundary>
  );
}
