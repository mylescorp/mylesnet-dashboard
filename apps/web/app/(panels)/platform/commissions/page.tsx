import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformCommissionLedger } from "@/platform/components/PlatformCommissionLedger";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const COMMISSION_READ_ROLES = [
  "platform_super_admin", "platform_finance", "platform_ops", "platform_owner", "platform_admin", "finance_manager", "ops_manager",
];

export default async function PlatformCommissionLedgerPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, COMMISSION_READ_ROLES)) redirect("/no-access");
  return <QueryErrorBoundary><PlatformCommissionLedger /></QueryErrorBoundary>;
}
