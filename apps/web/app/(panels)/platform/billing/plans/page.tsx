import { requirePanelAccess } from "@/lib/auth/panels";
import { PlatformPlanCatalog } from "@/platform/components/PlatformPlanCatalog";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";

export default async function PlatformPlansPage() {
  await requirePanelAccess("platform");
  return <QueryErrorBoundary><PlatformPlanCatalog /></QueryErrorBoundary>;
}
