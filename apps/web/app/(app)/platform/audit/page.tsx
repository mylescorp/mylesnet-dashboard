import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/app/components/QueryErrorBoundary";
import { PlatformAuditLog } from "@/app/components/PlatformAuditLog";

export default async function PlatformAuditPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <PlatformAuditLog />
    </QueryErrorBoundary>
  );
}