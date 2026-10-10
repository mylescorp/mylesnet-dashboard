import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { PlatformAnalytics } from "@/platform/components/PlatformAnalytics";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const ANALYTICS_READ_ROLES = [
  "platform_super_admin", "platform_finance", "platform_ops", "platform_readonly",
  "platform_owner", "platform_admin", "ops_manager", "finance_manager", "readonly",
  "org-platform_owner", "org-platform_admin",
];

export default async function PlatformAnalyticsPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, ANALYTICS_READ_ROLES)) redirect("/no-access");
  return <PlatformAnalytics />;
}
