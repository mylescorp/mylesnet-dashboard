import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import AccessManagementPage from "@/dashboard/routes/access/page";

export default async function PlatformAccessPage() {
  await requirePanelAccess("platform");
  return (
    <QueryErrorBoundary>
      <AccessManagementPage />
    </QueryErrorBoundary>
  );
}
