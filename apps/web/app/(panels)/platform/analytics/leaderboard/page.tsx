import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";
import { QueryErrorBoundary } from "@/platform/components/QueryErrorBoundary";
import { PlatformTenantLeaderboard } from "@/platform/components/PlatformTenantLeaderboard";

const LEADERBOARD_READ_ROLES = ["platform_super_admin", "platform_readonly", "platform_owner", "platform_admin", "readonly"];

export default async function PlatformLeaderboardPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, LEADERBOARD_READ_ROLES)) redirect("/no-access");
  return <QueryErrorBoundary><PlatformTenantLeaderboard /></QueryErrorBoundary>;
}
