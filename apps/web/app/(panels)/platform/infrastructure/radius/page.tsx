import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";
import { PlatformRadiusFleet } from "@/platform/components/PlatformRadiusFleet";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";

const readers = ["platform_super_admin", "platform_ops", "platform_finance", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "finance_manager", "readonly"];
const managers = ["platform_super_admin", "platform_ops", "platform_owner", "platform_admin", "ops_manager"];

export default async function PlatformRadiusPage() {
  await requirePanelAccess("platform");
  const user = await requireUser();
  if (!hasAnyRole(user.roleSlugs, readers)) redirect("/no-access");
  return <QueryErrorBoundary><PlatformRadiusFleet canManage={hasAnyRole(user.roleSlugs, managers)} /></QueryErrorBoundary>;
}
