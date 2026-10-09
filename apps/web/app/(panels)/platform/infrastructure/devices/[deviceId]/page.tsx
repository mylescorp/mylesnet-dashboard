import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformDeviceDetail } from "@/platform/components/PlatformDeviceDetail";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const DEVICE_READ_ROLES = ["platform_super_admin", "platform_ops", "platform_support", "platform_readonly", "platform_owner", "platform_admin", "ops_manager", "org-platform_owner", "org-platform_admin", "org-platform_support"];

export default async function PlatformDeviceDetailPage({ params }: { params: Promise<{ deviceId: string }> }) {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, DEVICE_READ_ROLES)) redirect("/no-access");
  const { deviceId } = await params;
  return <QueryErrorBoundary><PlatformDeviceDetail deviceId={deviceId} /></QueryErrorBoundary>;
}
