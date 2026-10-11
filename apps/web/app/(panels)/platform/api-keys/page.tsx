import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformApiKeys } from "@/platform/components/PlatformApiKeys";

export default async function PlatformApiKeysPage() {
  await requirePanelAccess("platform");
  const user = await requireUser();
  const roles = ["platform_super_admin", "platform_ops", "platform_owner", "ops_manager"];
  if (!hasAnyRole(user.roleSlugs, roles)) redirect("/no-access");
  const canManage = hasAnyRole(user.roleSlugs, ["platform_super_admin", "platform_owner"]);
  return <QueryErrorBoundary><PlatformApiKeys canManage={canManage} /></QueryErrorBoundary>;
}
