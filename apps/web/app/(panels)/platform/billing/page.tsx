import { redirect } from "next/navigation";
import { requirePanelAccess } from "@/lib/auth/panels";
import { PlatformRevenue } from "@/platform/components/PlatformRevenue";
import { hasAnyRole } from "@/shared/auth/rbac";
import { requireUser } from "@/shared/auth/session";

const REVENUE_READ_ROLES = [
  "platform_super_admin",
  "platform_finance",
  "platform_readonly",
  "platform_owner",
  "platform_admin",
  "finance_manager",
  "readonly",
];

export default async function PlatformBillingPage() {
  await requirePanelAccess("platform");
  const session = await requireUser();
  if (!hasAnyRole(session.roleSlugs, REVENUE_READ_ROLES)) redirect("/no-access");
  return <PlatformRevenue />;
}
