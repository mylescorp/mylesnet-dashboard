import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformBillingAnomalies } from "@/platform/components/PlatformBillingAnomalies";

const C6_ROLES = ["platform_super_admin", "platform_finance", "platform_ops", "platform_owner", "platform_admin", "finance_manager", "ops_manager"];
export default async function PlatformBillingAnomaliesPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, C6_ROLES)) redirect("/no-access");
  return <QueryErrorBoundary><PlatformBillingAnomalies /></QueryErrorBoundary>;
}
