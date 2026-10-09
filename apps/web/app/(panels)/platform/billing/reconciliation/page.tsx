import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformPaymentReconciliation } from "@/platform/components/PlatformPaymentReconciliation";

const C5_ROLES = ["platform_super_admin", "platform_finance", "platform_ops", "platform_owner", "platform_admin", "finance_manager", "ops_manager"];
export default async function PlatformReconciliationPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, C5_ROLES)) redirect("/no-access");
  return <QueryErrorBoundary><PlatformPaymentReconciliation /></QueryErrorBoundary>;
}
