import { requirePanelAccess } from "@/lib/auth/panels";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformDataRequests } from "@/platform/components/PlatformDataRequests";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";
import { redirect } from "next/navigation";

export default async function PlatformDataRequestsPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, ["platform_super_admin", "platform_owner", "platform_admin", "platform_support"])) {
    redirect("/no-access");
  }
  return <QueryErrorBoundary><PlatformDataRequests /></QueryErrorBoundary>;
}
