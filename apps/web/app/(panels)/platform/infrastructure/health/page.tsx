import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { PlatformDeviceHealth } from "@/platform/components/PlatformDeviceHealth";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const HEALTH_READ_ROLES = ["platform_super_admin", "platform_ops", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "org-platform_owner", "org-platform_admin", "org-platform_support"];

export default async function PlatformDeviceHealthPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, HEALTH_READ_ROLES)) redirect("/no-access");
  return <QueryErrorBoundary><PlatformDeviceHealth /></QueryErrorBoundary>;
}
