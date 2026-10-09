import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformVoucherMonitor } from "@/platform/components/PlatformVoucherMonitor";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const VOUCHER_MONITOR_READ_ROLES = [
  "platform_super_admin", "platform_ops", "platform_finance",
  "platform_owner", "platform_admin", "ops_manager", "finance_manager",
  "org-platform_owner", "org-platform_admin",
];

export default async function PlatformVoucherMonitorPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, VOUCHER_MONITOR_READ_ROLES)) redirect("/no-access");
  return (
    <QueryErrorBoundary>
      <PlatformVoucherMonitor />
    </QueryErrorBoundary>
  );
}
